package android.os;
/** Test stand-in: runs a posted Runnable on its own thread after one twentieth of the delay (the real Handler posts to the main thread). */
public class Handler {
    public Handler(Looper looper) { }
    public boolean postDelayed(final Runnable r, final long ms) {
        Thread t = new Thread(new Runnable() {
            public void run() {
                try { Thread.sleep(ms / 20); } catch (InterruptedException e) { return; }
                r.run();
            }
        });
        t.setDaemon(true);
        t.start();
        return true;
    }
}
