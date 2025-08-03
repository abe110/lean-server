import Lake
open Lake DSL

package "lean-server-container" where
  -- More configuration options can be added here.
  require mathlib from git
    "https://github.com/leanprover-community/mathlib4.git"

-- This defines the main library for our project.
@[default_target]
lean_lib "ProofVerify" where
  -- This is the crucial fix:
  -- We explicitly tell lake where to find the source files for this library.
  srcDir := "ProofVerify"
