using Microsoft.Extensions.Options;

namespace TacticalBoard.Api.Configuration;

/// <summary>Registers the API's own options.</summary>
public static class ConfigurationServiceCollectionExtensions
{
    /// <summary>Binds and validates <see cref="AppOptions"/>.</summary>
    public static IServiceCollection AddAppOptions(this IServiceCollection services)
    {
        services.AddOptions<AppOptions>().BindConfiguration(AppOptions.SectionName).ValidateOnStart();
        services.AddSingleton<IValidateOptions<AppOptions>, AppOptionsValidator>();
        return services;
    }
}
