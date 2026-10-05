# Backend (ASP.NET Core). Listens on port 8080 as a non-root user.
# Multi-platform (linux/amd64, linux/arm64): the SDK stage always runs on the build machine's
# platform and cross-compiles for the target architecture, so no emulation is needed for the
# .NET build. Only the small RUN steps of the runtime stage run emulated (QEMU) for a foreign
# platform (arc42 ch. 7, ADR-016).

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
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
RUN dotnet restore src/TacticalBoard.Api/TacticalBoard.Api.csproj --arch "$TARGETARCH"
COPY src/ src/
RUN dotnet publish src/TacticalBoard.Api/TacticalBoard.Api.csproj --no-restore --arch "$TARGETARCH" \
    --self-contained false --configuration Release --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
LABEL org.opencontainers.image.title="TacticalBoard backend" \
      org.opencontainers.image.source="https://github.com/SvBrunner/TacticalBoard" \
      org.opencontainers.image.licenses="MIT"
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
