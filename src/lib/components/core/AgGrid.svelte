<script lang="ts">
  import {
    AllCommunityModule,
    ModuleRegistry,
    createGrid,
    type GridApi,
    type ColDef,
  } from 'ag-grid-community';

  // Register all Community features
  ModuleRegistry.registerModules([AllCommunityModule]);
  let {
    rows,
    columns,
    gridApi = $bindable<GridApi | null>(null),
  }: { rows: any[]; columns: ColDef[]; gridApi: GridApi | null } = $props();
  const setupGrid = (div: HTMLDivElement) => {
    gridApi = createGrid(div, {
      columnDefs: columns,
      rowData: rows,
    });
  };
  $effect(() => {
    gridApi?.setGridOption('columnDefs', columns);
  });
  $effect(() => {
    gridApi?.setGridOption('rowData', rows);
  });
</script>

<div use:setupGrid class="h-full w-full"></div>
