package com.letschatafrica.nativetools;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Starter plugin. Copy this file and its folder when Letschat needs a new native Android feature.
 * From the page: Capacitor.registerPlugin('NativeTools').echo({ value: 'hello' })
 */
@CapacitorPlugin(name = "NativeTools")
public class NativeToolsPlugin extends Plugin {

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("value is required");
            return;
        }
        JSObject result = new JSObject();
        result.put("value", value);
        call.resolve(result);
    }
}
