namespace TacticalBoard.Api.ErrorHandling;

/// <summary>Registers RFC 7807 Problem Details error handling.</summary>
public static class ErrorHandlingServiceCollectionExtensions
{
    /// <summary>Adds Problem Details with the app's conventions and the domain exception handler.</summary>
    public static IServiceCollection AddApiErrorHandling(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = ProblemDetailsEnricher.Enrich);
        services.AddExceptionHandler<DomainExceptionHandler>();
        return services;
    }
}
