using System.ComponentModel.DataAnnotations;
using PhoneNumbers;

namespace OrderManagement.Api.Validation
{
    public class PhoneNumberAttribute : ValidationAttribute
    {
        // Default region used when the number doesn't include a country code (e.g. "0773010100").
        // Change this to match your primary user base, or see the note below for a fully international version.
        private const string DefaultRegion = "LK";

        protected override ValidationResult? IsValid(object? value, ValidationContext context)
        {
            if (value is not string phone || string.IsNullOrWhiteSpace(phone))
                return new ValidationResult("Phone number is required.");

            try
            {
                var phoneUtil = PhoneNumberUtil.GetInstance();
                var parsed = phoneUtil.Parse(phone, DefaultRegion);

                if (!phoneUtil.IsValidNumber(parsed))
                    return new ValidationResult("Phone number is not a valid number.");

                return ValidationResult.Success;
            }
            catch (NumberParseException)
            {
                return new ValidationResult("Phone number format is invalid.");
            }
        }
    }
}