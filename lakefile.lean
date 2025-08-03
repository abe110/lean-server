import Lake
open Lake DSL

package "lean-server-container" where
  -- More configuration options can be added here.
  -- This is the key change:
  -- We now declare that this package requires mathlib as a dependency.
  require mathlib from git
    "https://github.com/leanprover-community/mathlib4.git"

-- This defines the main library for our project.
lean_lib "ProofVerify" where
  -- We can add library-specific configuration here if needed.
