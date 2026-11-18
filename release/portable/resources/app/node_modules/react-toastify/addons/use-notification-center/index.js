var react = require('react');
var reactToastify = require('react-toastify');

function useNotificationCenter(params) {
  if (params === void 0) {
    params = {};
  }

  const sortFn = react.useRef(params.sort || defaultSort);
  const filterFn = react.useRef(params.filter || null);
  const [notifications, setNotifications] = react.useState(() => {
    if (params.data) {
      return filterFn.current ? params.data.filter(filterFn.current).sort(sortFn.current) : [...params.data].sort(sortFn.current);
    }

    return [];
  }); // used to method to be used inside effect without having stale `notifications`

  const notificationsRef = react.useRef(notifications);
  react.useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  react.useEffect(() => {
    return reactToastify.toast.onChange(toast => {
      if (toast.status === 'added' || toast.status === 'updated') {
        const newItem = decorate(toast);
        if (filterFn.current && !filterFn.current(newItem)) return;
        setNotifications(prev => {
          let nextState = [];
          const updateIdx = prev.findIndex(v => v.id === newItem.id);

          if (updateIdx !== -1) {
            nextState = prev.slice();
            Object.assign(nextState[updateIdx], newItem, {
              createdAt: Date.now()
            });
          } else if (prev.length === 0) {
            nextState = [newItem];
          } else {
            nextState = [newItem, ...prev];
          }

          return nextState.sort(sortFn.current);
        });
      }
    });
  }, []);

  const remove = id => {
    setNotifications(prev => prev.filter(Array.isArray(id) ? v => !id.includes(v.id) : v => v.id !== id));
  };

  const clear = () => {
    setNotifications([]);
  };

  const markAllAsRead = function (read) {
    if (read === void 0) {
      read = true;
    }

    setNotifications(prev => prev.map(v => {
      v.read = read;
      return v;
    }));
  };

  const markAsRead = function (id, read) {
    if (read === void 0) {
      read = true;
    }

    let map = v => {
      if (v.id === id) v.read = read;
      return v;
    };

    if (Array.isArray(id)) {
      map = v => {
        if (id.includes(v.id)) v.read = read;
        return v;
      };
    }

    setNotifications(prev => prev.map(map));
  };

  const find = id => {
    return Array.isArray(id) ? notificationsRef.current.filter(v => id.includes(v.id)) : notificationsRef.current.find(v => v.id === id);
  };

  const add = item => {
    if (notificationsRef.current.find(v => v.id === item.id)) return null;
    const newItem = decorate(item);
    setNotifications(prev => [...prev, newItem].sort(sortFn.current));
    return newItem.id;
  };

  const update = (id, item) => {
    const index = notificationsRef.current.findIndex(v => v.id === id);

    if (index !== -1) {
      setNotifications(prev => {
        const nextState = [...prev];
        Object.assign(nextState[index], item, {
          createdAt: item.createdAt || Date.now()
        });
        return nextState.sort(sortFn.current);
      });
      return item.id;
    }

    return null;
  };

  const sort = compareFn => {
    sortFn.current = compareFn;
    setNotifications(prev => prev.slice().sort(compareFn));
  };

  return {
    notifications,
    clear,
    markAllAsRead,
    markAsRead,
    add,
    update,
    remove,
    // @ts-ignore fixme: overloading issue
    find,
    sort,

    get unreadCount() {
      return notifications.reduce((prev, cur) => !cur.read ? prev + 1 : prev, 0);
    }

  };
}

function decorate(item) {
  if (item.id == null) item.id = Date.now().toString(36).substring(2, 9);
  if (!item.createdAt) item.createdAt = Date.now();
  if (item.read == null) item.read = false;
  return item;
} // newest to oldest


function defaultSort(l, r) {
  return r.createdAt - l.createdAt;
}

exports.useNotificationCenter = useNotificationCenter;
//# sourceMappingURL=index.js.map
