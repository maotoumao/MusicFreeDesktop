import Store from "@/common/store";
import { useEffect } from "react";

const fontsStore = new Store<FontData[] | null>(null);

async function initFonts() {
  if (fontsStore.getValue()) {
    return fontsStore.getValue();
  }
  try {
    const allFonts = await window.queryLocalFonts();
    fontsStore.setValue(allFonts);
    return allFonts;
  } catch (e) {
    console.log(e);
  }
  return null;
}

export default function useLocalFonts() {
  useEffect(() => {
    initFonts();
  }, []);

  return fontsStore.useValue();
}
