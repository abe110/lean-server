import Lake
open Lake DSL

package "lean-server-container" where
  -- Package configuration options can be added here

-- This is the crucial new line.
-- It tells Lean's build system that the "Proofs" directory contains
-- library files that are part of the project.
lean_lib "Proofs" where

@[default_target]
lean_exe "no-op" where
  root := `Main
  -- This is a dummy executable target required by `lake`.
  -- We won't actually run this executable, but it's needed for the build to work.

-- This line adds mathlib4 as a dependency from its GitHub repository.
require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git"
