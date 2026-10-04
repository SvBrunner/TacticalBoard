namespace TacticalBoard.Situations.Application;

/// <summary>The database's unique title index rejected a save (a parallel save took the title first).</summary>
internal sealed class TitleUniquenessViolationException : Exception
{
    public TitleUniquenessViolationException()
        : base("Another situation of the area has this title.")
    {
    }

    public TitleUniquenessViolationException(string message)
        : base(message)
    {
    }

    public TitleUniquenessViolationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>A parallel save wrote a revision first; <see cref="CurrentRevision"/> is the newest one now.</summary>
internal sealed class ConcurrentRevisionException : Exception
{
    public ConcurrentRevisionException()
        : this(0)
    {
    }

    public ConcurrentRevisionException(string message)
        : base(message)
    {
    }

    public ConcurrentRevisionException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public ConcurrentRevisionException(int currentRevision, Exception? innerException = null)
        : base($"The situation was saved in parallel (now revision {currentRevision}).", innerException)
    {
        CurrentRevision = currentRevision;
    }

    public int CurrentRevision { get; }
}
