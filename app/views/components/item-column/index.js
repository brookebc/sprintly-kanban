import _ from 'lodash';
import React from 'react/addons';
import moment from 'moment';
import ItemCard from '../item-card';
import Sprint from './sprint';
import ColumnSummary from './summary';
import ColumnHeader from './header';
import Loading from 'react-loading';
import ProductStore from '../../../stores/product-store';
import ProductActions from '../../../actions/product-actions';
import FilterActions from '../../../actions/filter-actions';
import ScoreMap from '../../../lib/score-map';

const EMPTY_CHUNK = {
  points: 0,
  items: []
};

function getColumnState(items=[], previousState={}) {
  return _.extend({
    items,
    isLoading: false,
    hideLoadMore: false,
    sortField: 'last_modified',
    sortDirection: 'desc',
    offset: 0,
    limit: 0
  }, previousState);
}

var ItemColumn = React.createClass({
  propTypes: {
    status: React.PropTypes.string.isRequired,
    product: React.PropTypes.object.isRequired
  },

  getInitialState() {
    let previousState = {};
    let previousSortField = window.localStorage.getItem(`itemColumn-${this.props.status}-sortField`);
    if (previousSortField) {
      previousState.sortField = previousSortField;
    }
    return getColumnState([], previousState);
  },

  _onChange() {
    let state = ProductStore.getItems(this.props.product.id, this.props.status);
    if (!state) {
      return;
    }

    state.isLoading = false;
    this.setState(state);
  },

  setSortCriteria(field=this.state.sortField, direction=this.state.sortDirection, status=this.props.status) {
    let items = ProductStore.getItemsCollection(this.props.product.id, status);
    if (!items) {
      return;
    }

    this.setState({ isLoading: true });
    let options = {
      field,
      direction,
      status
    };
    ProductActions.changeSortCriteria(items, options);
  },

  getItems(product, options={ hideLoader: false }) {
    this.setState({ isLoading: !options.hideLoader });
    ProductActions.getItemsForProduct(product, {
      filters: options.filters || this.props.filters,
      status: this.props.status,
      sortField: this.state.sortField,
      sortDirection: this.state.sortDirection
    })
  },

  loadMoreItems() {
    let items = ProductStore.getItemsCollection(this.props.product.id, this.props.status);
    if (!items) {
      return;
    }
    ProductActions.loadMoreItems(items);
  },

  componentDidMount() {
    ProductStore.addChangeListener(this._onChange);
    this.getItems(this.props.product);
  },

  componentWillUnmount() {
    ProductStore.removeChangeListener(this._onChange);
  },

  componentWillReceiveProps(nextProps) {
    var reload = false;

    if (nextProps.product.id !== this.props.product.id) {
      reload = true;
    }

    if (_.isEqual(nextProps.filters, this.props.filters) === false) {
      reload = true;
    }

    if (reload) {
      this.setState({ isLoading: true });
      this.getItems(nextProps.product, {
        filters: nextProps.filters
      });
    }
  },

  /**
   * Chunks the items passed into the props into sprints based on the current predicted velocity.
   * Each sprint chunk is an object with the following structure:
   * {
   *   points: {Number}, // the number of points in the sprint.
   *   items: {Array} // an array of objects containing item data
   * }
   *
   * @returns {Array} // an array of raw sprint chunks
   */
  chunkItems() {
    let chunks = [];
    let currentChunk = _.cloneDeep(EMPTY_CHUNK);
    _.each(this.state.items, (item, i) => {
      let itemScore = ScoreMap[item.score];
      currentChunk.points += itemScore;
      currentChunk.items.push(item);

      // Check whether adding the next item's score will push the current sprint chunks's point
      // count above the predicted velocity. If so, add it to the chunks collection and start a
      // new sprint chunk. In the case that the current sprint chunk is under the predicted velocity
      // by *more* than adding the next item would cause it to go over, allow the sprint's total to
      // go over the predicted velocity instead. This prevents things like a 3 or 5 point sprint
      // when followed by an 8 point sprint.
      let nextItem = this.state.items[i + 1] || {score: '~'};
      let nextItemScore = ScoreMap[nextItem.score];
      let scoreWithNext = currentChunk.points + nextItemScore;
      let nextScoreIsOverAverage = currentChunk.points + nextItemScore >= this.props.velocity.average;
      let underageIsGreaterThanOverage = this.props.velocity.average - currentChunk.points >
      scoreWithNext - this.props.velocity.average;

      let isLastItem = this.state.items.length === i + 1;

      if ((nextScoreIsOverAverage && !underageIsGreaterThanOverage) || isLastItem) {
        // Add the current chunk to the collection and start a new one
        chunks.push(currentChunk);
        currentChunk = _.cloneDeep(EMPTY_CHUNK);
      }
    });
    return chunks;
  },

  calculateSummary() {
    let points = _.reduce(this.state.items, function(total, item) {
      total += ScoreMap[item.score];
      return total;
    }, 0);
    return {
      points,
      startDate: moment().startOf('isoweek').format('D MMM')
    }
  },

  renderLoadMore() {
    var loadMore = <button className="load-more" onClick={this.loadMoreItems}>Load More</button>;

    if (this.state.isLoading || this.state.hideLoadMore || this.state.items.length < this.state.limit) {
      return '';
    }

    return loadMore;
  },

  renderItemCard(item, index) {
    let card = (
      <ItemCard
        item={item}
        members={this.props.members}
        sortField={this.state.sortField}
        productId={this.props.product.id}
        key={`item-${this.props.product.id}${item.number}`}
      />
    );
    return card;
  },

  renderItemCards() {
    let showSummary = this.props.status === 'in-progress' && this.state.sortField === 'priority';
    let itemCards = _.map(this.state.items, this.renderItemCard);
    if (showSummary) {
      let props = this.calculateSummary();
      return (
        <div>
          <ColumnSummary {...props} />
          {itemCards}
        </div>
      );
    } else {
      return (<div>{itemCards}</div>);
    }
  },

  renderSprints() {
    let rawSprints = this.chunkItems();
    return _.map(rawSprints, (sprint, i) => {
      // Start the groups in the backlog with the next week
      let startDate = moment().startOf('isoweek').add(7 * (i + 1), 'days').format('D MMM');
      return (
        <Sprint
          key={`item-group-${i}`}
          items={sprint.items}
          sortField={this.state.sortField}
          productId={this.props.product.id}
          startDate={startDate}
          startOpen={i === 0}
          points={sprint.points}
        />
      );
    });
  },

  render() {
    let classes = {
      column: true,
      [this.props.status]: true
    };

    let reverseSort = (ev) => {
      let direction = this.state.sortDirection === 'desc' ? 'asc' : 'desc';
      this.setSortCriteria(this.state.sortField, direction);
    };

    let showSprints = this.props.status === 'backlog' && this.state.sortField === 'priority';
    let renderCardsOrSprints = showSprints ? this.renderSprints : this.renderItemCards;

    return (
      <div className={React.addons.classSet(classes)} {...this.props}>
        <ColumnHeader {...this.props}
          reverse={reverseSort}
          setSortCriteria={this.setSortCriteria}
          sortDirection={this.state.sortDirection}
          sortField={this.state.sortField}
        />
        {this.state.isLoading ?
          <div className="loading"><Loading type="bubbles" color="#ccc"/></div> :
          renderCardsOrSprints()
        }
        {this.renderLoadMore()}
      </div>
    );
  }
});

module.exports = ItemColumn

