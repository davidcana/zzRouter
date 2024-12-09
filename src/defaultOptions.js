// Default options

blueRouter.defaultOptions = {
    browserHistoryOnLoad: true,
    pagePrefix: '!',

    // Animations
    animationOut: 'slide-out-top',
    animationIn: 'scale-in-center',

    // Special pages ids
    PAGE_ID_HOME: '[home]',
    PAGE_ID_404_ERROR: '[404]',

    // Events
    EVENT_INIT: 'init',
    EVENT_REINIT: 'reinit',
    EVENT_MOUNTED: 'mounted',
    EVENT_BEFORE_OUT: 'beforeOut',
    EVENT_AFTER_OUT: 'afterOut',

    EVENT_PRE_PREFIX: 'pre_'
};

