using System.ComponentModel.DataAnnotations;

namespace OrderManagement.Api.DTOs
{
    public class OrderItemCreateDto
    {
        [Required]
        public int ProductId { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be greater than 0")]
        public int Quantity { get; set; }
    }

    public class OrderCreateDto
    {
        [Required]
        public int CustomerId { get; set; }

        [Required, MinLength(1, ErrorMessage = "Order must contain at least one product")]
        public List<OrderItemCreateDto> Items { get; set; } = new();
    }

    // Used for GET /api/orders (list view)
    public class OrderListItemDto
    {
        public int Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public decimal Total { get; set; }
    }

    // Used for GET /api/orders/{id} (detail view)
    public class OrderDetailDto
    {
        public int Id { get; set; }
        public DateTime OrderDate { get; set; }
        public decimal Total { get; set; }

        public CustomerReadDto Customer { get; set; } = null!;
        public List<OrderItemDetailDto> Items { get; set; } = new();
    }

    public class OrderItemDetailDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal => Quantity * UnitPrice;
    }
}