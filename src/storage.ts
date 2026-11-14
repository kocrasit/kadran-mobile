import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Telefonda kalıcı saklanan küçük ayarlar (doğum günü, kaydedilen günler). */
export function useStored<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`kadran:${key}`)
      .then((raw) => { if (raw != null) setValue(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [key]);

  const save = (v: T) => {
    setValue(v);
    AsyncStorage.setItem(`kadran:${key}`, JSON.stringify(v)).catch(() => {});
  };
  return [value, save, ready];
}
