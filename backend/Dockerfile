# Backend (ASP.NET Core). Listens on port 8080 as a non-root user.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore first, from the project files only, so the layer is cached until a dependency changes.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/Modules/Directory.Build.props src/Modules/
COPY src/TacticalBoard.SharedKernel/*.csproj src/TacticalBoard.SharedKernel/
COPY src/TacticalBoard.Infrastructure/*.csproj src/TacticalBoard.Infrastructure/
COPY src/Modules/TacticalBoard.Users/*.csproj src/Modules/TacticalBoard.Users/
COPY src/Modules/TacticalBoard.Teams/*.csproj src/Modules/TacticalBoard.Teams/
COPY src/Modules/TacticalBoard.Areas/*.csproj src/Modules/TacticalBoard.Areas/
COPY src/Modules/TacticalBoard.Folders/*.csproj src/Modules/TacticalBoard.Folders/
COPY src/Modules/TacticalBoard.Situations/*.csproj src/Modules/TacticalBoard.Situations/
COPY src/TacticalBoard.Api/*.csproj src/TacticalBoard.Api/
RUN dotnet restore src/TacticalBoard.Api/TacticalBoard.Api.csproj
COPY src/ src/
RUN dotnet publish src/TacticalBoard.Api/TacticalBoard.Api.csproj --no-restore --configuration Release --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql probes for GSSAPI (Kerberos) when it connects; without the library it logs an error.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
# Data-protection keys (DataProtection__KeysDirectory); a volume mounted here inherits the owner.
RUN mkdir -p /var/lib/tacticalboard/keys && chown "$APP_UID" /var/lib/tacticalboard/keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "TacticalBoard.Api.dll"]
