using System.ComponentModel.DataAnnotations;

namespace OrderManagement.Api.DTOs
{
    public class CustomerCreateDto
    {
        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required, MaxLength(30)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Address { get; set; }
    }

    public class CustomerUpdateDto : CustomerCreateDto { }

    public class CustomerReadDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Address { get; set; }
    }
}