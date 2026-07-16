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
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomersController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/customers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CustomerReadDto>>> GetAll()
        {
            var customers = await _context.Customers
                .Select(c => new CustomerReadDto
                {
                    Id = c.Id, Name = c.Name, Email = c.Email, Phone = c.Phone, Address = c.Address
                })
                .ToListAsync();

            return Ok(customers);
        }

        // GET /api/customers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CustomerReadDto>> GetById(int id)
        {
            var c = await _context.Customers.FindAsync(id);
            if (c == null) return NotFound($"Customer with id {id} not found.");

            return Ok(new CustomerReadDto
            {
                Id = c.Id, Name = c.Name, Email = c.Email, Phone = c.Phone, Address = c.Address
            });
        }

        // GET /api/customers/search?name=john
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<CustomerReadDto>>> Search([FromQuery] string name)
        {
            var customers = await _context.Customers
                .Where(c => c.Name.Contains(name))
                .Select(c => new CustomerReadDto
                {
                    Id = c.Id, Name = c.Name, Email = c.Email, Phone = c.Phone, Address = c.Address
                })
                .ToListAsync();

            return Ok(customers);
        }

        // POST /api/customers
        [HttpPost]
        public async Task<ActionResult<CustomerReadDto>> Create(CustomerCreateDto dto)
        {
            // Enforce unique email manually so we can return a friendly 400 instead of a raw DB error
            bool emailExists = await _context.Customers.AnyAsync(c => c.Email == dto.Email);
            if (emailExists) return BadRequest("A customer with this email already exists.");

            var customer = new Customer
            {
                Name = dto.Name,
                Email = dto.Email,
                Phone = dto.Phone,
                Address = dto.Address
            };

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            var result = new CustomerReadDto
            {
                Id = customer.Id, Name = customer.Name, Email = customer.Email,
                Phone = customer.Phone, Address = customer.Address
            };
            return CreatedAtAction(nameof(GetById), new { id = customer.Id }, result);
        }

        // PUT /api/customers/5
        // PUT /api/customers/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Update(int id, CustomerUpdateDto dto)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound($"Customer with id {id} not found.");

            bool emailTaken = await _context.Customers
                .AnyAsync(c => c.Email == dto.Email && c.Id != id);
            if (emailTaken) return BadRequest("Another customer already uses this email.");

            customer.Name = dto.Name;
            customer.Email = dto.Email;
            customer.Phone = dto.Phone;
            customer.Address = dto.Address;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/customers/5
        // DELETE /api/customers/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound($"Customer with id {id} not found.");

            bool hasOrders = await _context.Orders.AnyAsync(o => o.CustomerId == id);
            if (hasOrders) return BadRequest("Cannot delete a customer that has existing orders.");

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
            return NoContent();
        }
        
    }
}