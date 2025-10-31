<script lang="ts" generics="T">
  import {
    AllCommunityModule,
    ModuleRegistry,
    createGrid,
    type ColDef,
    type GridApi,
    type GridOptions,
  } from 'ag-grid-community';

  // Register all Community features
  ModuleRegistry.registerModules([AllCommunityModule]);

  let {
    columns,
    rows,
    gridOptions: gridOpts,
  }: {
    columns: ColDef<T>[];
    rows: T[];
    gridOptions?: GridOptions<T>;
  } = $props();

  let gridOptions = $state({
    columnDefs: columns,
    rowData: rows,
    ...gridOpts,
  });
  let gridApi = $state<GridApi<T>>();

  let createGridInner = (element: HTMLDivElement) => {
    if (!element) return;
    gridApi = createGrid(element, gridOptions);
  };
  $effect(() => {
    if (!gridApi) return;
    gridApi.setGridOption('columnDefs', columns);
    gridApi.setGridOption('rowData', rows);
  });
</script>

<div use:createGridInner class="h-full w-full"></div>
