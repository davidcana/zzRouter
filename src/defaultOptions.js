// Default options

blueRouter.defaultOptions = {
    browserHistoryOnLoad: true,
    pagePrefix: '!',
    preloadPages: false,

    // Animations
    animationOut: 'slide-out-top',
    animationIn: 'scale-in-center',
    animateFirstTransition: false,
    
    // Special pages ids
    PAGE_ID_HOME: '[home]',
    PAGE_ID_404_ERROR: '[404]',

    // Events
    EVENT_PRE_INIT: 'preInit',
    EVENT_INIT: 'init',
    EVENT_PRE_REINIT: 'preReinit',
    EVENT_REINIT: 'reinit',
    EVENT_MOUNTED: 'mounted',
    EVENT_BEFORE_OUT: 'beforeOut',
    EVENT_AFTER_OUT: 'afterOut',

    RUN_RENDER_BEFORE_EVENT_INIT: true,
    RUN_RENDER_BEFORE_EVENT_REINIT: false

};

