// Shared between UnlockOptions.tsx and BuyBlockConsent.tsx — every checkout
// entry point needs the exact same withdrawal-right consent text (čl. 7
// Obchodných podmienok), so it lives in one place instead of two copies
// that could drift out of sync.
export const CONSENT_LABEL = (
  <>
    Žiadam o okamžité sprístupnenie zakúpených lekcií po úspešnej platbe a beriem na vedomie, že
    týmto strácam právo na odstúpenie od zmluvy vo vzťahu k lekciám, ktoré si pozriem pred
    uplynutím 14-dňovej lehoty na odstúpenie (čl. 7{" "}
    <a
      href="https://strhnidav.sk/obchodne-podmienky"
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-cream"
    >
      Obchodných podmienok
    </a>
    ).
  </>
);
