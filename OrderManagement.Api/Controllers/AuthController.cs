using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using OrderManagement.Api.DTOs;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace OrderManagement.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _config;
        public AuthController(IConfiguration config) => _config = config;

        [HttpPost("login")]
        public ActionResult<LoginResponseDto> Login(LoginDto dto)
        {
            var validUsername = _config["AdminUser:Username"];
            var validPassword = _config["AdminUser:Password"];

            if (dto.Username != validUsername || dto.Password != validPassword)
                return Unauthorized("Invalid username or password.");

            var expiresInMinutes = double.Parse(_config["Jwt:ExpiresInMinutes"]!);
            var expires = DateTime.UtcNow.AddMinutes(expiresInMinutes);

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, dto.Username)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return Ok(new LoginResponseDto
            {
                Token = new JwtSecurityTokenHandler().WriteToken(token),
                ExpiresAt = expires
            });
        }
    }
}