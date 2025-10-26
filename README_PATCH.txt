Läxkollen patch v13.4.6
Date: 2025-10-26T07:09:38.191204

Fixar:
- Hantera barn: ämneschips ligger nu i rader som bryts; namn-fältet hamnar inte i egen kolumn.
- Ingen horisontell scroll på iPhone (overflow-x:hidden globalt och i modalen).
- Markeringsfärg återställd till lila (samma som ämneschip i appen) för både subject chips och modalens chips.
- Behåller större läxkort från v13.4.5.

Installation:
1) Ersätt filerna i projektet med innehållet i denna zip.
2) Ladda om sidan två gånger så ny service worker (lk-v13.4.6) aktiveras.
3) Testa Hantera barn: chips ska radbrytas, ingen sidscroll.
