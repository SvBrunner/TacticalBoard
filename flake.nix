{
  description = "A flake for the tactical board";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";
  };

  outputs = inputs: {

    devShells = builtins.mapAttrs (system: pkgs: {
      default = pkgs.mkShell {
        packages = [
          # frontend
          pkgs.pnpm
          pkgs.nodejs
          # backend
          pkgs.dotnet-sdk_10
        ];

        DOTNET_CLI_TELEMETRY_OPTOUT = "1";
      };
    }) inputs.nixpkgs.legacyPackages;
  };
}
