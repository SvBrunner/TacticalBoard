{
  description = "A flake for the tactical board";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";
  };

  outputs = inputs: {

    devShells = builtins.mapAttrs (system: pkgs: {
      default = pkgs.mkShell {
        packages = [
          pkgs.pnpm
          pkgs.nodejs
        ];
      };
    }) inputs.nixpkgs.legacyPackages;
  };
}