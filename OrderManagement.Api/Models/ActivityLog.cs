namespace OrderManagement.Api.Models
{
    public class ActivityLog
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;   // Create / Update / Delete
        public string Entity { get; set; } = string.Empty;   // customers / products / orders
        public int? EntityId { get; set; }
        public string? Details { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}