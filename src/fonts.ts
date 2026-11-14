import { useFonts } from 'expo-font';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight';
import { Oswald_500Medium, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { PTSerif_400Regular, PTSerif_700Bold } from '@expo-google-fonts/pt-serif';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import {
  SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/** Dönem yazı tiplerini yükler. Hata olursa sistem fontuyla devam eder. */
export function useEraFonts(): boolean {
  const [loaded, error] = useFonts({
    Oswald_500Medium, Oswald_700Bold,
    PTSerif_400Regular, PTSerif_700Bold,
    ArchivoBlack_400Regular,
    Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black,
    SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
    InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, InterTight_700Bold, InterTight_800ExtraBold,
  });
  return loaded || !!error;
}
