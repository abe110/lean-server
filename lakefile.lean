import Lake
open Lake DSL

package "lean-server-container" where
  -- Package configuration options can be added here

-- This defines the main library for our project.
-- By convention, its source files live in a directory
-- with the same name (e.g., "LeanServerContainer").
lean_lib "LeanServerContainer" where
  -- We can add library-specific configuration here if needed.

-- This line adds mathlib4 as a dependency from its GitHub repository.
require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git"
