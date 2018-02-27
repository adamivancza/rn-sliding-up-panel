import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  View,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Platform,
  SafeAreaView
} from 'react-native'

import FlickAnimation from './libs/FlickAnimation'
import {visibleHeight} from './libs/layout'
import styles from './libs/styles'

const deprecated = (condition, message) => condition && console.warn(message)

class SlidingUpPanel extends Component {
  static propTypes = {
    draggableRange: PropTypes.shape({
      top: PropTypes.number.isRequired,
      bottom: PropTypes.number.isRequired
    }),
    minimisedHeight: PropTypes.number.isRequired,
    height: PropTypes.number,
    onDrag: PropTypes.func,
    onDragStart: PropTypes.func,
    onDragEnd: PropTypes.func,
    onRequestClose: PropTypes.func,
    allowMomentum: PropTypes.bool,
    allowDragging: PropTypes.bool,
    showBackdrop: PropTypes.bool
  }

  static defaultProps = {
    height: visibleHeight,
    minimisedHeight: 200,
    draggableRange: {top: visibleHeight, bottom: 0},
    onDrag: () => {},
    onDragStart: () => {},
    onDragEnd: () => {},
    onRequestClose: () => {},
    allowMomentum: true,
    allowDragging: false,
    showBackdrop: false
  }

  constructor(props) {
    super(props)

    this._onDrag = this._onDrag.bind(this)
    this._requestClose = this._requestClose.bind(this)
    this._renderBackdrop = this._renderBackdrop.bind(this)
    this._isInsideDraggableRange = this._isInsideDraggableRange.bind(this)

    this.transitionTo = this.transitionTo.bind(this)

    this.state = {
      minimised: false
    };
  }

  componentWillMount() {
    if (__DEV__) {
      deprecated(
        this.props.contentStyle,
        'SlidingUpPanel#contentStyle is deprecated. ' +
          'You should wrap your content inside a View.'
      )
    }

    const {top, bottom} = this.props.draggableRange

    this._animatedValueY = -bottom
    this._translateYAnimation = new Animated.Value(this._animatedValueY)
    this._flick = new FlickAnimation(this._translateYAnimation, -top, -bottom)

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._onStartShouldSetPanResponder.bind(this),
      onMoveShouldSetPanResponder: this._onMoveShouldSetPanResponder.bind(this),
      onPanResponderGrant: this._onPanResponderGrant.bind(this),
      onPanResponderMove: this._onPanResponderMove.bind(this),
      onPanResponderRelease: this._onPanResponderRelease.bind(this),
      onPanResponderTerminate: this._onPanResponderTerminate.bind(this),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => false
    })

    this._translateYAnimation.addListener(this._onDrag)
    this.transitionTo(-this.props.draggableRange.top, () => {}, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.draggableRange.top !== this.props.draggableRange.top ||
      nextProps.draggableRange.bottom !== this.props.draggableRange.bottom
    ) {
      const {top, bottom} = nextProps.draggableRange
      this._flick = new FlickAnimation(this._translateYAnimation, -top, -bottom)
    }
  }

  componentDidUpdate() {
    const {bottom} = this.props.draggableRange
    if (this._animatedValueY !== -bottom && this.state.minimised) {
      this._translateYAnimation.setValue(-bottom)
    }
  }

  // eslint-disable-next-line no-unused-vars
  _onStartShouldSetPanResponder(evt, gestureState) {
    return (
      this.props.allowDragging && this._isInsideDraggableRange(this._animatedValueY)
    )
  }

  _onMoveShouldSetPanResponder(evt, gestureState) {
    return (
      this.props.allowDragging &&
      this._isInsideDraggableRange(this._animatedValueY) &&
      Math.abs(gestureState.dy) > 1
    )
  }

  // eslint-disable-next-line no-unused-vars
  _onPanResponderGrant(evt, gestureState) {
    this._flick.stop()
    this._translateYAnimation.setOffset(this._animatedValueY)
    this._translateYAnimation.setValue(0)
    this.props.onDragStart(-this._animatedValueY)
  }

  _onPanResponderMove(evt, gestureState) {
    if (!this._isInsideDraggableRange(this._animatedValueY)) {
      return
    }

    this._translateYAnimation.setValue(gestureState.dy)
  }

  // Trigger when you release your finger
  _onPanResponderRelease(evt, gestureState) {
    if (!this._isInsideDraggableRange(this._animatedValueY)) {
      return
    }

    this._translateYAnimation.flattenOffset()
    const cancelFlick = this.props.onDragEnd(-this._animatedValueY)

    if (!this.props.allowMomentum || cancelFlick) {
      return
    }

    if (Math.abs(gestureState.vy) > 0.1) {
      this._flick.start({
        velocity: gestureState.vy,
        fromValue: this._animatedValueY
      })
    }

    return
  }

  // eslint-disable-next-line no-unused-vars
  _onPanResponderTerminate(evt, gestureState) {
    //
  }

  _isInsideDraggableRange(value) {
    return (
      value >= -this.props.draggableRange.top &&
      value <= -this.props.draggableRange.bottom
    )
  }

  _onDrag({value}) {
    if (this._isInsideDraggableRange(value)) {
      this._animatedValueY = value
      this.props.onDrag(value)
    }

    if (value >= -this.props.draggableRange.bottom) {
      this.props.onRequestClose()
      return
    }
  }

  toMinimised() {
    this.transitionTo(this.props.minimisedHeight, () => this.setState({ minimised: true }));
  }

  toFull() {
    this.setState({ minimised: false }, () => this.transitionTo(this.props.draggableRange.top));
  }

  transitionTo(value, onAnimationEnd = () => {}, duration = 260) {
    const animationConfig = {
      toValue: -Math.abs(value),
      duration,
      // eslint-disable-next-line no-undefined, max-len
      delay: Platform.OS === 'android' ? 166.67 : undefined // to make it looks smooth on android
    }

    Animated.timing(this._translateYAnimation, animationConfig).start(onAnimationEnd)
  }

  _requestClose() {
    const {bottom} = this.props.draggableRange
    if (this._animatedValueY === -bottom) {
      return this.props.onRequestClose()
    }

    return this.transitionTo(-this.props.draggableRange.bottom, () =>
      this.props.onRequestClose()
    )
  }

  _renderBackdrop() {
    if (!this.props.showBackdrop) {
      return <View style={{ flex: 1 }} pointerEvents="none"/>
    }
    const {top, bottom} = this.props.draggableRange

    const backdropOpacity = this._translateYAnimation.interpolate({
      inputRange: [-top, -bottom],
      outputRange: [0.75, 0],
      extrapolate: 'clamp'
    })

    return (
      <TouchableWithoutFeedback
        onPressIn={() => this._flick.stop()}
        onPress={() => this._requestClose()}>
        <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]} />
      </TouchableWithoutFeedback>
    )
  }

  render() {
    let {top, bottom} = this.props.draggableRange;
    if (this.state.minimised) {
      bottom = this.props.minimisedHeight;
    }

    const height = this.props.height

    const translateY = this._translateYAnimation.interpolate({
      inputRange: [-top, -bottom],
      outputRange: [-top, -bottom],
      extrapolate: 'clamp'
    })

    const transform = {transform: [{translateY}]}

    const animatedContainerStyles = [
      styles.animatedContainer,
      this.props.contentStyle,
      transform,
      {height, top: visibleHeight, bottom: 0}
    ]

    const showFullContent = !this.state.minimised || (this.state.minimised && !this.props.minimisedContent);

    return (
      <SafeAreaView style={styles.container} pointerEvents='box-none'>
        {this._renderBackdrop()}
        {showFullContent && <Animated.View
          {...this._panResponder.panHandlers}
          style={animatedContainerStyles}>
          {this.props.children}
        </Animated.View>}
        {!showFullContent && <Animated.View
          {...this._panResponder.panHandlers}
          style={animatedContainerStyles}>
          {this.props.minimisedContent()}
        </Animated.View>}
      </SafeAreaView>
    )
  }
}

export default SlidingUpPanel
