import _ from 'lodash'
import React from 'react/addons'
import classNames from 'classnames'
import {State,Link} from 'react-router'

import SidebarConstants from '../../constants/sidebar-constants'
import ProductStore from '../../stores/product-store'

const ACCOUNT_SETTINGS = [
  'Profile', 'Plan', 'Billing', 'Invoices', 'Products', 'Members', 'Notifications', 'Services'
]

let Sidebar = React.createClass({

  propTypes: {
    type: React.PropTypes.string.isRequired,
    open: React.PropTypes.bool.isRequired
  },

  mixins: [State],

  getInitialState() {
    return {
      allProducts: ProductStore.getAll()
    }
  },

  _onChange() {
    this.setState({
      allProducts: ProductStore.getAll()
    })
  },

  componentDidMount() {
    ProductStore.addChangeListener(this._onChange)
  },

  componentWillUnmount() {
    ProductStore.removeChangeListener(this._onChange)
  },

  buildContentforType() {
    var content

    switch (this.props.type) {
      case SidebarConstants.CORE:
        content = this.coreSidebar()
        break
      case SidebarConstants.FILTERS:
        content = this.filtersSidebar()
        break
      default:
        content = ''
        console.log('SIDEBARD CONTENT TYPE NOT HANDLED: ', this.props.type) // eslint-disable-line no-console
    }

    return content
  },

  coreSidebar() {
    let sidebarClasses = classNames({
      'left-off-canvas-menu': true,
      'hidden': this.props.open
    })

    let productLinks = this.productLinks()
    let settingsLinks = this.settingsLinks()

    return (
      <div className={sidebarClasses}>
        <div className="logos__sprintly"></div>
        <ul className="off-canvas-list">
          {productLinks}
          {settingsLinks}
        </ul>
      </div>
    )
  },

  settingsLinks() {
    let settingsLinks = _.map(ACCOUNT_SETTINGS, function(setting, i) {
      let subheaderKey = `drawer-subheader-${i} ${setting}`
      let settingsURI = `https://sprint.ly/account/settings/${setting.toLowerCase()}`

      return (
        <li key={subheaderKey}>
          <a className="drawer-subheader" href={settingsURI}>{setting}</a>
        </li>
      )
    })

    return ([
      <li className="drawer-header" key="drawer-header">
        <a className="drawer-header" href="#">Settings</a>
      </li>
    ].concat(settingsLinks).concat([
      <li className="logout" key="logout">
        <a href="/logout" className="btn btn-danger btn-sm btn-block">Logout</a>
      </li>
    ]))
  },

  productLinks() {
    let productLinks = _.map(this.state.allProducts, (product, i) => {
      let subheaderKey = `drawer-subheader-${i} product-${product.id}`

      return (
        <li key={subheaderKey}>
          <Link className="drawer-subheader" to="product" params={{ id: product.id }}>{product.name}</Link>
        </li>
      )
    })

    return ([
      <li className="drawer-header" key="drawer-header">
        <a className={'drawer-header'} href="#">Products</a>
      </li>
    ].concat(productLinks))
  },

  filtersSidebar() {
    return(
      <h1 style={{color: 'red'}}>FILTERS</h1>
    )
  },

  render() {
    let classes = classNames({
      'col-xs-6': true,
      'col-sm-3': true,
      'sidebar-offcanvas': true,
      'visible-xs': true
    })

    var sidebar = this.buildContentforType()

    return (
      <div className={classes}>
        {sidebar}
      </div>
    )
  }
})
export default Sidebar
