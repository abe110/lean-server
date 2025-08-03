import Lake
open Lake DSL

package "lean-server-container" where
  -- More configuration options can be added here.

-- This defines the main library for our project.
-- By making this the default target, we give `lake` a clear primary goal.
@[default_target]
lean_lib "ProofVerify" where
  -- We can add library-specific configuration here if needed.

-- This line adds mathlib4 as a dependency from its GitHub repository.
require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git"
