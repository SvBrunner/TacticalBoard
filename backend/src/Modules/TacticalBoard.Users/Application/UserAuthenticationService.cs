using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Users.Contracts;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Application;

/// <summary>Just-in-time users and per-request session checks (arc42 ch. 8.13, 8.14).</summary>
internal sealed class UserAuthenticationService(
    IUserRepository users,
    SystemAdministratorBootstrap bootstrap,
    CurrentUserState currentUser,
    IIdGenerator ids,
    IClock clock) : IUserAuthentication
{
    /// <inheritdoc />
    public async Task<UserSignInResult> SignInAsync(ExternalLogin login, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(login);
        if (!ExternalIdentity.IsValid(login.Issuer, login.Subject))
        {
            return UserSignInResult.Rejected(SignInRejection.InvalidIdentity);
        }

        var identity = new ExternalIdentity(login.Issuer, login.Subject);

        var existing = await users.FindByIdentityIncludingDeletedAsync(identity, cancellationToken);
        if (existing is not null)
        {
            return await SignInExistingAsync(existing, cancellationToken);
        }

        var user = User.Register(
            ids.NewId(),
            identity,
            DisplayName.FromIdentityProvider(login.Name, login.PreferredUsername, login.Email),
            clock.UtcNow);
        await bootstrap.ApplyAsync(user, isFirstLogin: true, cancellationToken);
        try
        {
            await users.AddAsync(user, cancellationToken);
            return UserSignInResult.Success(user.Id);
        }
        catch (DuplicateUserIdentityException)
        {
            // A parallel first login of the same identity won; continue with its user.
            var winner = await users.FindByIdentityIncludingDeletedAsync(identity, cancellationToken)
                ?? throw new InvalidOperationException("The user disappeared after a duplicate first login.");
            return await SignInExistingAsync(winner, cancellationToken);
        }
    }

    /// <inheritdoc />
    public async Task<bool> ResumeSessionAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindSessionUserAsync(userId, cancellationToken);
        if (user is null || user.IsBlocked)
        {
            return false;
        }

        currentUser.Set(user);
        return true;
    }

    private async Task<UserSignInResult> SignInExistingAsync(User user, CancellationToken cancellationToken)
    {
        if (user.IsDeleted)
        {
            return UserSignInResult.Rejected(SignInRejection.Deleted);
        }

        if (user.IsBlocked)
        {
            return UserSignInResult.Rejected(SignInRejection.Blocked);
        }

        if (await bootstrap.ApplyAsync(user, isFirstLogin: false, cancellationToken))
        {
            await users.SaveChangesAsync(cancellationToken);
        }

        return UserSignInResult.Success(user.Id);
    }
}
