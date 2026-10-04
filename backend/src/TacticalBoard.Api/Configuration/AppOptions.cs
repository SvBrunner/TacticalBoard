namespace TacticalBoard.Api.Configuration;

/// <summary>General application settings (configuration section <c>App</c>, e.g. <c>App__PublicBaseUrl</c>).</summary>
public sealed class AppOptions
{
    /// <summary>The configuration section.</summary>
    public const string SectionName = "App";

    /// <summary>
    /// The public URL under which browsers reach the app through the reverse proxy, e.g.
    /// <c>https://tacticalboard.example.org</c>. Optional for now; the login (BFF, roadmap Phase 2
    /// step 2) builds its callback URL from it.
    /// </summary>
    public Uri? PublicBaseUrl { get; set; }
}
