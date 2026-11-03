package org.json;
import java.util.*;
/** Small stand-in with Android's org.json behaviour for the calls the poller makes (a JSON null reads as the text "null" in optString). */
public class JSONObject {
    public static final Object NULL = new Object() { public String toString() { return "null"; } public boolean equals(Object o) { return o == this || o == null; } };
    final Map<String, Object> map = new LinkedHashMap<String, Object>();
    public JSONObject() { }
    public JSONObject(String json) throws JSONException {
        Parser p = new Parser(json);
        Object v = p.value();
        p.end();
        if (!(v instanceof JSONObject)) throw new JSONException("Value is not a JSONObject");
        map.putAll(((JSONObject) v).map);
    }
    public JSONObject put(String k, Object v) throws JSONException { map.put(k, v); return this; }
    public Object opt(String k) { return map.get(k); }
    public boolean isNull(String k) { Object o = map.get(k); return o == null || o == NULL; }
    public String optString(String k, String fallback) { Object o = map.get(k); if (o == null) return fallback; return String.valueOf(o); }
    public JSONObject optJSONObject(String k) { Object o = map.get(k); return o instanceof JSONObject ? (JSONObject) o : null; }
    public JSONArray optJSONArray(String k) { Object o = map.get(k); return o instanceof JSONArray ? (JSONArray) o : null; }
    public boolean optBoolean(String k, boolean fallback) {
        Object o = map.get(k);
        if (o instanceof Boolean) return (Boolean) o;
        if (o instanceof String) { if ("true".equalsIgnoreCase((String) o)) return true; if ("false".equalsIgnoreCase((String) o)) return false; }
        return fallback;
    }
    public long optLong(String k, long fallback) {
        Object o = map.get(k);
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof String) { try { return (long) Double.parseDouble((String) o); } catch (NumberFormatException e) { return fallback; } }
        return fallback;
    }
    public Iterator<String> keys() { return new ArrayList<String>(map.keySet()).iterator(); }
    @Override public String toString() {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : map.entrySet()) { if (!first) sb.append(','); first = false; sb.append(quote(e.getKey())).append(':').append(e.getValue() instanceof String ? quote((String) e.getValue()) : String.valueOf(e.getValue())); }
        return sb.append('}').toString();
    }
    static String quote(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

    /** minimal recursive-descent JSON parser */
    static final class Parser {
        final String s; int i = 0;
        Parser(String s) { this.s = s; }
        void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
        void end() throws JSONException { ws(); if (i != s.length()) throw new JSONException("trailing data at " + i); }
        Object value() throws JSONException {
            ws();
            if (i >= s.length()) throw new JSONException("unexpected end");
            char c = s.charAt(i);
            if (c == '{') {
                i++; JSONObject o = new JSONObject(); ws();
                if (s.charAt(i) == '}') { i++; return o; }
                while (true) {
                    ws(); Object k = value(); if (!(k instanceof String)) throw new JSONException("bad key"); ws();
                    if (s.charAt(i++) != ':') throw new JSONException("expected :");
                    o.map.put((String) k, value()); ws();
                    char d = s.charAt(i++);
                    if (d == '}') return o;
                    if (d != ',') throw new JSONException("expected , or }");
                }
            }
            if (c == '[') {
                i++; JSONArray a = new JSONArray(); ws();
                if (s.charAt(i) == ']') { i++; return a; }
                while (true) {
                    a.list.add(value()); ws();
                    char d = s.charAt(i++);
                    if (d == ']') return a;
                    if (d != ',') throw new JSONException("expected , or ]");
                }
            }
            if (c == '"') {
                i++; StringBuilder sb = new StringBuilder();
                while (true) {
                    char d = s.charAt(i++);
                    if (d == '"') return sb.toString();
                    if (d == '\\') {
                        char e = s.charAt(i++);
                        switch (e) {
                            case 'n': sb.append('\n'); break; case 't': sb.append('\t'); break; case 'r': sb.append('\r'); break;
                            case 'b': sb.append('\b'); break; case 'f': sb.append('\f'); break;
                            case 'u': sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                            default: sb.append(e);
                        }
                    } else sb.append(d);
                }
            }
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return NULL; }
            int st = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            if (st == i) throw new JSONException("bad value at " + i);
            String num = s.substring(st, i);
            try { return Long.parseLong(num); } catch (NumberFormatException e) { return Double.parseDouble(num); }
        }
    }
}
