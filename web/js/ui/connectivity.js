/** Tells the user when the connection drops or returns, and wakes the external AI. */
export function watchConnectivity({ toast, ai }) {
    window.addEventListener('offline', () => {
        toast.show('Brak internetu – dyktowanie i zewnętrzne AI chwilowo niedostępne', 4000);
        ai.external.reportOffline();
    });
    window.addEventListener('online', () => {
        toast.show('Połączenie wróciło', 2000);
        ai.reconnect();
    });
}
