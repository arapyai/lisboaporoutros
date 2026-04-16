{
  description = "Lisboa por Outros backend development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            python312
            uv
            postgresql_16
            libpq
            openssl
            pkg-config
            gcc
            gnumake
            git
          ];

          env = {
            UV_PROJECT_ENVIRONMENT = ".venv";
          };

          shellHook = ''
            export PS1="(lisboa-backend) $PS1"
            export UV_PROJECT_ENVIRONMENT=".venv"
          '';
        };
      });
}
