using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrderManagement.Api.Data;
using OrderManagement.Api.DTOs;
using OrderManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;

namespace OrderManagement.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public ProductsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductReadDto>>> GetAll()
        {
            var products = await _context.Products
                .Select(p => new ProductReadDto { Id = p.Id, Name = p.Name, Price = p.Price, Stock = p.Stock })
                .ToListAsync();
            return Ok(products);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProductReadDto>> GetById(int id)
        {
            var p = await _context.Products.FindAsync(id);
            if (p == null) return NotFound($"Product with id {id} not found.");
            return Ok(new ProductReadDto { Id = p.Id, Name = p.Name, Price = p.Price, Stock = p.Stock });
        }

        [HttpPost]
        public async Task<ActionResult<ProductReadDto>> Create(ProductCreateDto dto)
        {
            var product = new Product { Name = dto.Name, Price = dto.Price, Stock = dto.Stock };
            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            var result = new ProductReadDto { Id = product.Id, Name = product.Name, Price = product.Price, Stock = product.Stock };
            return CreatedAtAction(nameof(GetById), new { id = product.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, ProductUpdateDto dto)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound($"Product with id {id} not found.");

            product.Name = dto.Name;
            product.Price = dto.Price;
            product.Stock = dto.Stock;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound($"Product with id {id} not found.");

            bool usedInOrders = await _context.OrderItems.AnyAsync(oi => oi.ProductId == id);
            if (usedInOrders) return BadRequest("Cannot delete a product that appears in existing orders.");

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}