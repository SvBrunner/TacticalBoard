using Microsoft.Extensions.Configuration;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Infrastructure;

/// <summary>
/// Reads <c>Bootstrap:SystemAdministrators</c> (arc42 ch. 8.14): entries <c>issuer|subject</c>,
/// either as one value separated by <c>;</c> or line breaks (<c>Bootstrap__SystemAdministrators</c>),
/// or as a list (<c>Bootstrap__SystemAdministrators__0</c>, <c>__1</c>, …), or both.
/// </summary>
internal static class BootstrapConfiguration
{
    public const string SectionName = "Bootstrap:SystemAdministrators";

    private static readonly char[] EntrySeparators = [';', '\n', '\r'];

    /// <exception cref="InvalidOperationException">An entry is not in the format <c>issuer|subject</c>.</exception>
    public static BootstrapAdministrators Read(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var section = configuration.GetSection(SectionName);
        var entries = Split(section.Value)
            .Concat(section.GetChildren().SelectMany(child => Split(child.Value)));

        var identities = new List<ExternalIdentity>();
        foreach (var entry in entries)
        {
            try
            {
                identities.Add(ExternalIdentity.Parse(entry));
            }
            catch (FormatException exception)
            {
                throw new InvalidOperationException(
                    $"Invalid entry in {SectionName.Replace(":", "__", StringComparison.Ordinal)}: {exception.Message}", exception);
            }
        }

        return new BootstrapAdministrators(identities);
    }

    private static string[] Split(string? value) =>
        (value ?? string.Empty)
            .Split(EntrySeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
