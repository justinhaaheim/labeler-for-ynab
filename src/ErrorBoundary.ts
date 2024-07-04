import * as React from 'react';

type State = {
  error: Error | null | undefined;
  moduleName: string;
};

type Props = {
  children?: React.ReactElement | null;
  description?: string;
  fallback?: (arg0: Error, arg1: string) => React.ReactElement | null;

  /**
   * If you want to reset error state, just increase this counter.
   */
  forceResetErrorCount?: number;
  onError?: (error: Error, moduleName: string) => void;
};

function getReactElementDisplayName(
  element: React.ReactElement | null,
): string {
  if (element == null) {
    return '#empty';
  }

  if (
    typeof element === 'string' ||
    typeof element === 'number' ||
    typeof element === 'boolean'
  ) {
    return '#text';
  }

  // $FlowFixMe found re-enabling React typing
  // @ts-ignore ignore plz
  const elementType = element.type;
  if (elementType == null) {
    return 'ReactComponent';
  }

  if (typeof elementType === 'string') {
    return elementType;
  }

  // $FlowFixMe[incompatible-use]
  // $FlowFixMe[prop-missing]
  // @ts-ignore ignore plz
  const {displayName, name} = element;

  return (
    (displayName != null ? displayName : '(no display name)') ||
    (name != null ? name : '(no element name)') ||
    'ReactComponent'
  );
}

/**
 * This implements error boundary, which catches child component render errors
 * and render an empty component, or a fallback component if specified.
 * This allows application authors to partition app into regions, and a crash
 * in a single region won't take down the entire page/application.
 *
 * The usage is
 *
 * render() {
 *   return <ErrorBoundary><Bar /></ErrorBoundary>;
 * }
 *
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  static defaultProps: {
    forceResetErrorCount: number;
  } = {
    forceResetErrorCount: 0,
  };

  suppressReactDefaultErrorLogging = true;

  override state: State = {
    error: null,
    moduleName: getModuleName(this.props.children ?? null),
  };

  static getDerivedStateFromError(error: Error) {
    return {error: error};
  }

  override componentDidCatch(
    _: Error,
    {componentStack}: {componentStack: string},
  ) {
    const {description = 'base', onError} = this.props;

    const {error, moduleName} = this.state;

    // This null/undefined check is technically unnecessary;
    // it exists to satisfy Flow and avoid an :any cast.
    if (error != null) {
      console.error(`Error caught in ErrorBoundary: `, error.message, {
        componentStack,
        description,
      });

      if (typeof onError === 'function') {
        onError(error, moduleName);
      }
    }
  }

  override componentDidUpdate(prevProps: Props): unknown {
    if (this.state.error) {
      if (
        this.props.forceResetErrorCount != null &&
        this.props.forceResetErrorCount !== prevProps.forceResetErrorCount
      ) {
        this.setState({error: null});
        return;
      }
    }
    return;
  }

  override render(): React.ReactElement | null {
    const {error, moduleName} = this.state;
    if (error) {
      const fallback = this.props.fallback;
      if (fallback != null) {
        return fallback(error, moduleName);
      }

      return null;
    }

    return this.props.children ?? null;
  }
}

/**
 * Return the module name of the first or only child as an identifier of what
 * went wrong.
 */

function getModuleName(children: React.ReactElement | null) {
  const rep =
    React.Children.count(children) > 1
      ? React.Children.toArray(children)[0]
      : children;

  // @ts-ignore ignore plz
  return getReactElementDisplayName(rep);
}
