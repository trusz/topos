<script lang="ts">
  import { help } from "../util/helper"; // relative import from inside a Svelte component
  const label = help();
</script>

<div>{label}</div>
