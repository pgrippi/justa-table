import Ember from 'ember';
import layout from '../templates/components/table-columns';

const {
  A,
  get,
  set,
  isEmpty,
  isNone,
  computed,
  computed: { readOnly }
} = Ember;

let uuid = 0;

export default Ember.Component.extend({
  layout,
  classNames: ['table-columns'],
  classNameBindings: ['columnId'],

  /**
    The parent table component, it is expected to be passed in.
    @public
  */
  table: null,

  /**
    All columns currently registered with this wrapper.
    @private
  */
  _allColumns: null,

  /**
    Css classes to apply to table rows.
    @public
  */
  rowClasses: null,

  /**
    Name of data property for row groups
    @public
  */
  rowGroupDataName: readOnly('table.rowGroupDataName'),

  /**
    Unique ID for the table-columns component
    @private
  */
  columnId: computed(function columnId() {
    return `justa-table-columns-${++uuid}`;
  }),

  /**
    The stylesheet to attach css rules to. Only used for fixed height tables.
    @private
  */
  stylesheet: null,

  init() {
    this._super(...arguments);
    this._allColumns = new A();

    this.set('stylesheet', createStylesheet(this.get('columnId')));
  },

  /**
    Merged css classes to apply to table rows. Merges table.rowClasses and rowClasses.
    @public
  */
  mergedRowClasses: computed('table.rowClasses', 'rowClasses', function() {
    let tableClasses = this.get('table.rowClasses');
    let rowClasses = this.get('rowClasses');
    return new A([tableClasses, rowClasses]).compact().join(' ');
  }),

  /**
    Sets an inline style for height on all table rows from table.rowHeight.
    @public
  */
  rowHeight: computed('table.rowHeight', function() {
    let rowHeight = this.get('table.rowHeight');

    if (rowHeight) {
      return new Ember.Handlebars.SafeString(`height: ${rowHeight}`);
    }

    return new Ember.Handlebars.SafeString('');
  }),

  /**
    Keeps track of all unique columns. Used to render the th's of the table.
    Uniques on header name.
    @returns { Array } Array of unique columns
    @public
  */
  columns: computed('_allColumns.[]', function columns() {
    let uniqueColumns = new A();
    this.get('_allColumns').forEach((column) => {
      let headerName = column.get('headerName');
      let existingHeaderNames = new A(uniqueColumns.mapBy('headerName'));
      if (!existingHeaderNames.contains(headerName)) {
        uniqueColumns.push(column);
      }
    });

    return uniqueColumns.sortBy('index');
  }),

  /**
    Register a child column with this table columns wrapper.
    @param { Object } The column to register
    @public
  */
  registerColumn(column) {
    let columns = this.get('_allColumns');
    column.index = column.index || -1;
    columns.addObject(column);
    Ember.run.debounce(this, this._computeCss, 350);
  },

  /**
    Unregister a previously registered child column with this table columns
    wrapper.
    @param { Object } The column to register
    @public
  */
  unregisterColumn(column) {
    let allColumns = this.get('_allColumns');
    allColumns.removeObject(column);
    Ember.run.debounce(this, this._computeCss, 350);
  },

  hasFixedHeight: computed('table.fixedHeight', function hasFixedHeight() {
    let fixedHeight = this.get('table.fixedHeight');
    return fixedHeight !== false && fixedHeight > 0;
  }),

  /**
   * The fixed height style for the `<tbody>` element
   * @private
   */
  tbodyStyle: computed('hasFixedHeight', 'columns.@each.width', function tbodyStyle() {
    let hasFixedHeight = this.get('hasFixedHeight');
    if (hasFixedHeight) {
      let fixedHeight = this.get('table.fixedHeight');
      let width = this.get('columns').reduce((a, b) => a + b.get('width'), 0);
      return Ember.String.htmlSafe(`width:${width}px;height:${fixedHeight}px`);
    }
    return Ember.String.htmlSafe('');
  }),

  _computeCss() {
    if (!this.get('hasFixedHeight')) {
      return;
    }

    let columns = this.get('columns');
    let columnId = this.get('columnId');
    let { sheet } = this.get('stylesheet');

    for (let i = 0; i < columns.length; ++i) {
      let column = columns.objectAt(i);

      sheet.insertRule(`.${columnId} td:nth-child(${i + 1}) { min-width: ${column.get('width')}px; max-width: ${column.get('width')}px; }`, i);
    }
  },

  didInsertElement() {
    this._super(...arguments);

    this.$().on('mouseenter', 'tr', this._onRowEnter.bind(this));
    this.$().on('mouseleave', 'tr', this._onRowLeave.bind(this));
  },

  willDestroyElement() {
    this._super(...arguments);

    this.$().off('mouseenter', 'tr', this._onRowEnter.bind(this));
    this.$().off('mouseleave', 'tr', this._onRowLeave.bind(this));

    let stylesheet = this.get('stylesheet');
    if (stylesheet) {
      document.head.removeChild(stylesheet);
      this.set('stylesheet', null);
      stylesheet = null;
    }
  },

  _onRowEnter() {
    let rowIndex = this.$('tr').index(this.$('tr:hover'));
    this.getAttr('table').$(`tr.table-row:nth-child(${rowIndex})`).addClass('hover');
  },

  _onRowLeave() {
    this.getAttr('table').$('tr').removeClass('hover');
  },

  actions: {
    // TODO: move to collapse table
    toggleRowCollapse(rowGroup) {
      let collapsed = get(rowGroup, 'isCollapsed');

      if (isNone(collapsed)) {
        set(rowGroup, 'isCollapsed', false);
      } else {
        set(rowGroup, 'isCollapsed', !rowGroup.isCollapsed);
      }
      // TODO make this smarter by taking option if we should do this
      let rowData = get(rowGroup, this.get('rowGroupDataName'));
      let shouldFetch = isEmpty(rowData) && !rowGroup.isCollapsed;

      if (shouldFetch) {
        set(rowGroup, 'loading', true);
        this.attrs.onRowExpand(rowGroup).then((data) => {
          set(rowGroup, this.get('rowGroupDataName'), rowData.concat(data));
        }).finally(() => {
          set(rowGroup, 'loading', false);
        });
      }
    },

    columnWidthChanged(/* column, newWidth */) {
      console.debug('columnWidthChanged')
      // no-op
    }
  }
});

function createStylesheet(columnId) {
  let stylesheet = document.createElement('style');
  stylesheet.id = `styles-for-${columnId}`;
  stylesheet.type = 'text/css';
  document.head.appendChild(stylesheet);
  return stylesheet;
}
