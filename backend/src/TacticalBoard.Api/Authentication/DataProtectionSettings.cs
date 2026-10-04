namespace TacticalBoard.Api.Authentication;

/// <summary>Where the data-protection keys (which protect the session cookie) are kept (section <c>DataProtection</c>).</summary>
public sealed class DataProtectionSettings
{
    /// <summary>The configuration section.</summary>
    public const string SectionName = "DataProtection";

    /// <summary>The application name the keys are isolated by.</summary>
    public const string ApplicationName = "TacticalBoard";

    /// <summary>
    /// A directory (a volume in containers) the keys are persisted to, so sessions survive a
    /// restart. Without it the keys are kept in ASP.NET Core's default location (in a container:
    /// lost on recreation, which ends every session).
    /// </summary>
    public string? KeysDirectory { get; set; }
}
