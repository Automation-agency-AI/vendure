import {
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChildren,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    SimpleChanges,
    TemplateRef,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { LocalStorageService } from '@vendure/admin-ui/core';
import { PaginationService } from 'ngx-pagination';
import { Subscription } from 'rxjs';
import { SelectionManager } from '../../../common/utilities/selection-manager';
import { DataTableFilterCollection } from '../../../providers/data-table-filter/data-table-filter-collection';

import { DataTable2ColumnComponent } from './data-table-column.component';

/**
 * @description
 * A table for displaying PaginatedList results. It is designed to be used inside components which
 * extend the {@link BaseListComponent} class.
 *
 * @example
 * ```HTML
 * <vdr-data-table
 *   [items]="items$ | async"
 *   [itemsPerPage]="itemsPerPage$ | async"
 *   [totalItems]="totalItems$ | async"
 *   [currentPage]="currentPage$ | async"
 *   (pageChange)="setPageNumber($event)"
 *   (itemsPerPageChange)="setItemsPerPage($event)"
 * >
 *   <!-- The header columns are defined first -->
 *   <vdr-dt-column>{{ 'common.name' | translate }}</vdr-dt-column>
 *   <vdr-dt-column></vdr-dt-column>
 *   <vdr-dt-column></vdr-dt-column>
 *
 *   <!-- Then we define how a row is rendered -->
 *   <ng-template let-taxRate="item">
 *     <td class="left align-middle">{{ taxRate.name }}</td>
 *     <td class="left align-middle">{{ taxRate.category.name }}</td>
 *     <td class="left align-middle">{{ taxRate.zone.name }}</td>
 *     <td class="left align-middle">{{ taxRate.value }}%</td>
 *     <td class="right align-middle">
 *       <vdr-table-row-action
 *         iconShape="edit"
 *         [label]="'common.edit' | translate"
 *         [linkTo]="['./', taxRate.id]"
 *       ></vdr-table-row-action>
 *     </td>
 *     <td class="right align-middle">
 *       <vdr-dropdown>
 *         <button type="button" class="btn btn-link btn-sm" vdrDropdownTrigger>
 *           {{ 'common.actions' | translate }}
 *           <clr-icon shape="caret down"></clr-icon>
 *         </button>
 *         <vdr-dropdown-menu vdrPosition="bottom-right">
 *           <button
 *               type="button"
 *               class="delete-button"
 *               (click)="deleteTaxRate(taxRate)"
 *               [disabled]="!(['DeleteSettings', 'DeleteTaxRate'] | hasPermission)"
 *               vdrDropdownItem
 *           >
 *               <clr-icon shape="trash" class="is-danger"></clr-icon>
 *               {{ 'common.delete' | translate }}
 *           </button>
 *         </vdr-dropdown-menu>
 *       </vdr-dropdown>
 *     </td>
 *   </ng-template>
 * </vdr-data-table>
 * ```
 *
 * @docsCategory components
 */
@Component({
    selector: 'vdr-data-table-2',
    templateUrl: 'data-table2.component.html',
    styleUrls: ['data-table2.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [PaginationService],
})
export class DataTable2Component<T> implements AfterContentInit, OnChanges, OnInit, OnDestroy {
    @Input() id: string;
    @Input() items: T[];
    @Input() itemsPerPage: number;
    @Input() currentPage: number;
    @Input() totalItems: number;
    @Input() emptyStateLabel: string;
    @Input() selectionManager?: SelectionManager<T>;
    @Input() searchTermControl?: FormControl<string>;
    @Input() searchTermPlaceholder?: string;
    @Input() filters: DataTableFilterCollection;
    @Output() pageChange = new EventEmitter<number>();
    @Output() itemsPerPageChange = new EventEmitter<number>();

    @ContentChildren(DataTable2ColumnComponent) columns: QueryList<DataTable2ColumnComponent<T>>;
    @ContentChildren(TemplateRef) templateRefs: QueryList<TemplateRef<any>>;
    rowTemplate: TemplateRef<any>;
    currentStart: number;
    currentEnd: number;
    // This is used to apply a `user-select: none` CSS rule to the table,
    // which allows shift-click multi-row selection
    disableSelect = false;
    private subscription: Subscription | undefined;

    constructor(
        private changeDetectorRef: ChangeDetectorRef,
        private localStorageService: LocalStorageService,
    ) {}

    get visibleColumns() {
        return this.columns?.filter(c => c.visible) ?? [];
    }

    private shiftDownHandler = (event: KeyboardEvent) => {
        if (event.shiftKey && !this.disableSelect) {
            this.disableSelect = true;
            this.changeDetectorRef.markForCheck();
        }
    };

    private shiftUpHandler = (event: KeyboardEvent) => {
        if (this.disableSelect) {
            this.disableSelect = false;
            this.changeDetectorRef.markForCheck();
        }
    };

    ngOnInit() {
        if (this.selectionManager) {
            document.addEventListener('keydown', this.shiftDownHandler, { passive: true });
            document.addEventListener('keyup', this.shiftUpHandler, { passive: true });
        }

        this.subscription = this.selectionManager?.selectionChanges$.subscribe(() =>
            this.changeDetectorRef.markForCheck(),
        );
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.items) {
            this.currentStart = this.itemsPerPage * (this.currentPage - 1);
            this.currentEnd = this.currentStart + changes.items.currentValue?.length;
            this.selectionManager?.setCurrentItems(this.items);
        }
    }

    ngOnDestroy() {
        if (this.selectionManager) {
            document.removeEventListener('keydown', this.shiftDownHandler);
            document.removeEventListener('keyup', this.shiftUpHandler);
        }
        this.subscription?.unsubscribe();
    }

    ngAfterContentInit(): void {
        this.rowTemplate = this.templateRefs.last;
        const dataTableConfig = this.localStorageService.get('dataTableConfig') ?? {};

        if (!this.id) {
            console.warn(`No id was assigned to the data table component`);
        }
        const updateColumnVisibility = () => {
            if (!dataTableConfig[this.id]) {
                dataTableConfig[this.id] = { visibility: [] };
            }
            dataTableConfig[this.id].visibility = this.columns
                .filter(c => (c.visible && c.hiddenByDefault) || (!c.visible && !c.hiddenByDefault))
                .map(c => c.heading);
            this.localStorageService.set('dataTableConfig', dataTableConfig);
        };

        this.columns.forEach(column => {
            if (dataTableConfig?.[this.id]?.visibility.includes(column.heading)) {
                column.setVisibility(column.hiddenByDefault);
            }
            column.onColumnChange(updateColumnVisibility);
        });
    }

    trackByFn(index: number, item: any) {
        if ((item as any).id != null) {
            return (item as any).id;
        } else {
            return index;
        }
    }

    onToggleAllClick() {
        this.selectionManager?.toggleSelectAll();
    }

    onRowClick(item: T, event: MouseEvent) {
        this.selectionManager?.toggleSelection(item, event);
    }
}