package org.json;
import java.util.*;
public class JSONArray {
    final List<Object> list = new ArrayList<Object>();
    public int length() { return list.size(); }
    public Object opt(int i) { return i >= 0 && i < list.size() ? list.get(i) : null; }
    public JSONObject optJSONObject(int i) { Object o = opt(i); return o instanceof JSONObject ? (JSONObject) o : null; }
    public String optString(int i, String fallback) { Object o = opt(i); return o == null ? fallback : String.valueOf(o); }
}
