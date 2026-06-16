export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const sendPushNotification = (title, options = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  new Notification(title, {
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    ...options
  });
};
