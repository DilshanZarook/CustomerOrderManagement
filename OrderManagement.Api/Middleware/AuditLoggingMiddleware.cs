using OrderManagement.Api.Data;
using OrderManagement.Api.Models;
using System.Security.Claims;

namespace OrderManagement.Api.Middleware
{
    public class AuditLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        public AuditLoggingMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            await _next(context);

            var method = context.Request.Method;
            var path = context.Request.Path.Value ?? "";
            bool isMutating = method is "POST" or "PUT" or "DELETE";
            bool isAuthRoute = path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase);
            bool success = context.Response.StatusCode is >= 200 and < 300;

            if (isMutating && !isAuthRoute && success && context.User.Identity?.IsAuthenticated == true)
            {
                var db = context.RequestServices.GetRequiredService<AppDbContext>();
                var username = context.User.FindFirst(ClaimTypes.Name)?.Value ?? "unknown";
                var role = context.User.FindFirst(ClaimTypes.Role)?.Value ?? "unknown";

                var segments = path.Trim('/').Split('/');
                var entity = segments.Length > 1 ? segments[1] : "unknown";
                int? entityId = segments.Length > 2 && int.TryParse(segments[2], out var id) ? id : null;

                var action = method switch { "POST" => "Create", "PUT" => "Update", "DELETE" => "Delete", _ => method };

                db.ActivityLogs.Add(new ActivityLog
                {
                    Username = username,
                    Role = role,
                    Action = action,
                    Entity = entity,
                    EntityId = entityId,
                    Details = $"{action} on {entity}" + (entityId.HasValue ? $" #{entityId}" : ""),
                    Timestamp = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }
        }
    }
}