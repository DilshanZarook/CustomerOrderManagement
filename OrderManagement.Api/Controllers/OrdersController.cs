using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrderManagement.Api.Data;
using OrderManagement.Api.DTOs;
using OrderManagement.Api.Models;

namespace OrderManagement.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public OrdersController(AppDbContext context) => _context = context;

        // GET /api/orders
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OrderListItemDto>>> GetAll()
        {
            var orders = await _context.Orders
                .Include(o => o.Customer)
                .Select(o => new OrderListItemDto
                {
                    Id = o.Id,
                    CustomerName = o.Customer!.Name,
                    OrderDate = o.OrderDate,
                    Total = o.Total
                })
                .ToListAsync();

            return Ok(orders);
        }

        // GET /api/orders/5
        [HttpGet("{id}")]
        public async Task<ActionResult<OrderDetailDto>> GetById(int id)
        {
            var order = await _context.Orders
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null) return NotFound($"Order with id {id} not found.");

            var dto = new OrderDetailDto
            {
                Id = order.Id,
                OrderDate = order.OrderDate,
                Total = order.Total,
                Customer = new CustomerReadDto
                {
                    Id = order.Customer!.Id,
                    Name = order.Customer.Name,
                    Email = order.Customer.Email,
                    Phone = order.Customer.Phone,
                    Address = order.Customer.Address
                },
                Items = order.OrderItems.Select(oi => new OrderItemDetailDto
                {
                    ProductId = oi.ProductId,
                    ProductName = oi.Product!.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice
                }).ToList()
            };

            return Ok(dto);
        }

        // POST /api/orders
        [HttpPost]
        public async Task<ActionResult> Create(OrderCreateDto dto)
        {
            // 1. Customer must exist
            var customer = await _context.Customers.FindAsync(dto.CustomerId);
            if (customer == null) return BadRequest($"Customer with id {dto.CustomerId} does not exist.");

            // 2. All requested products must exist
            var productIds = dto.Items.Select(i => i.ProductId).ToList();
            var products = await _context.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Distinct().Count())
                return BadRequest("One or more products do not exist.");

            // 3. Check stock BEFORE changing anything
            foreach (var item in dto.Items)
            {
                var product = products.First(p => p.Id == item.ProductId);
                if (product.Stock < item.Quantity)
                    return BadRequest($"Insufficient stock for '{product.Name}'. Available: {product.Stock}, requested: {item.Quantity}.");
            }

            // 4. All checks passed — create order, reduce stock, inside a transaction
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var order = new Order { CustomerId = dto.CustomerId, OrderDate = DateTime.UtcNow };
                decimal total = 0;

                foreach (var item in dto.Items)
                {
                    var product = products.First(p => p.Id == item.ProductId);
                    order.OrderItems.Add(new OrderItem
                    {
                        ProductId = product.Id,
                        Quantity = item.Quantity,
                        UnitPrice = product.Price
                    });
                    product.Stock -= item.Quantity;
                    total += product.Price * item.Quantity;
                }
                order.Total = total;

                _context.Orders.Add(order);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction(nameof(GetById), new { id = order.Id }, new { orderId = order.Id, total = order.Total });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}