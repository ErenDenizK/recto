/**
 * The sample's copy (docs/design/sample-2026-10/design.md §4): Margin No. 07 / Kenar Sayı 07,
 * a fictional quarterly's press-week folder. Turkish in the siz register (BR-V3), sentence
 * case, no exclamation marks. A `Cut` string differs per edition (§1.4): the full cut says
 * choose / select / type with key hints (never a double-click on text: in viewing it selects
 * a word, TXT-20), the phone cut tap / press and hold / pinch with the compact edition's own
 * labels. Every person, place, company and number is invented.
 */
import type { SampleEdition, SampleLocale } from './context.ts';

export interface Cut<T = string> {
  readonly full: T;
  readonly phone: T;
}

export const cut = <T>(value: Cut<T>, edition: SampleEdition): T => value[edition];

export interface ContentsRow {
  readonly page: string;
  readonly title: string;
  readonly dek: string;
}

export interface SampleCopy {
  readonly lang: SampleLocale;
  /** Document title: the app names the File after it (apps/web/src/sample/sample-file.ts). */
  readonly title: string;
  readonly subject: string;
  readonly footer: string;
  readonly head: string;
  readonly tryLabel: string;
  /** Outline titles by page id. */
  readonly outline: Record<string, string>;
  readonly cover: {
    readonly tagline: string;
    readonly masthead: string;
    readonly issue: string;
    readonly lines: readonly {
      readonly page: string;
      readonly title: string;
      readonly dek: string;
    }[];
    readonly linkPrefix: string;
    readonly alt: string;
    readonly tryLine: string;
    readonly listLabel: string;
    /** The slate beside the lamp at 18:52 (MOB-14). */
    readonly lampOn: string;
  };
  readonly letter: {
    readonly section: string;
    readonly kicker: string;
    readonly title: string;
    readonly paragraphs: readonly string[];
    readonly signoff: string;
    readonly marginLabel: string;
    readonly contentsTitle: string;
    readonly contents: readonly ContentsRow[];
    readonly folderTitle: string;
    readonly folder: readonly ContentsRow[];
    readonly folderPhone: string;
    readonly note: { readonly author: string; readonly text: string };
    readonly tryLine: Cut;
  };
  readonly feature: {
    readonly section: string;
    readonly kicker: string;
    readonly title: readonly string[];
    readonly deck: string;
    readonly byline: string;
    /** Column 1 (P1–P4) and column 2's paragraphs (P5, P6) around the quote. */
    readonly col1: readonly string[];
    readonly p5: string;
    readonly quote: string;
    readonly p6: string;
    readonly caption: string;
    readonly footnote: string;
    /** The logbook sidebar under column 1's free lines. */
    readonly logLabel: string;
    readonly log: readonly string[];
    readonly alt: string;
    readonly tryLine: Cut;
  };
  readonly contact: {
    readonly section: string;
    readonly kicker: string;
    readonly title: string;
    readonly intro: string;
    readonly instruction: string;
    readonly alt: string;
    readonly roll: string;
    readonly notes: string;
    readonly tryLine: Cut;
  };
  readonly agreement: {
    readonly section: string;
    readonly title: string;
    readonly sub: string;
    readonly terms: readonly string[];
    readonly cardTitle: string;
    readonly name: string;
    readonly date: string;
    readonly email: string;
    readonly feeLabel: string;
    readonly feeTransfer: string;
    readonly feeTrust: string;
    readonly consentLabel: string;
    readonly agree: string;
    readonly signature: string;
    readonly place: string;
    readonly tryLine: Cut;
  };
  readonly scan: {
    readonly alt: string;
    readonly letter: readonly string[];
    readonly stamp: string;
    readonly tryLine: string;
  };
  readonly invoice: {
    readonly section: string;
    readonly printer: string;
    readonly printerLine: string;
    readonly number: string;
    readonly date: string;
    readonly billTo: string;
    readonly billName: string;
    readonly description: string;
    readonly amount: string;
    readonly rows: readonly (readonly [string, string])[];
    readonly totals: readonly (readonly [string, string])[];
    readonly payTitle: string;
    readonly pay: readonly (readonly [string, string])[];
    readonly terms: string;
    readonly thanks: string;
    readonly tryLine: string;
  };
  readonly flatplan: {
    readonly section: string;
    readonly kicker: string;
    readonly title: Cut;
    readonly alt: Cut;
    readonly labels: Record<string, string>;
    readonly note: Cut;
    readonly noteName: string;
    readonly keptTitle: string;
    readonly lines: Cut<readonly string[]>;
    readonly end: string;
    /** The night's last slate, after the flatplan's frame (06:41): the lamp goes off (MOB-14). */
    readonly lampOff: string;
    readonly tryLine: Cut;
  };
}

const EN: SampleCopy = {
  lang: 'en',
  title: 'Recto sample',
  subject:
    'Margin No. 07, a fictional magazine’s press-week folder: each page shows one thing to try in Recto. Fictional data.',
  footer: 'Recto sample · fictional data',
  head: 'MARGIN · NO. 07 · LIGHT',
  tryLabel: 'TRY',
  outline: {
    cover: 'Cover',
    letter: 'Keeping a light on',
    feature: 'The last keeper of Cape Ardıç',
    contact: 'Roll three',
    agreement: 'Contributor agreement',
    scan: 'A letter from the cape',
    invoice: 'Invoice 2026-0412',
    flatplan: 'Flatplan',
    'flatplan-phone': 'Flatplan',
  },
  cover: {
    tagline: 'A quarterly for things at the edge',
    masthead: 'Margin',
    issue: 'NO. 07 · LIGHT · AUTUMN 2026',
    lines: [
      {
        page: 'feature',
        title: 'The last keeper of Cape Ardıç',
        dek: 'Thirty-one years, 112 steps, one lamp',
      },
      {
        page: 'contact',
        title: 'Roll three',
        dek: 'Inside the lamp room: twelve frames by Jonah Pell',
      },
      { page: 'agreement', title: 'Write for us', dek: 'The contributor agreement' },
    ],
    linkPrefix: 'Go to page',
    alt: 'A lighthouse at night throwing a lime and mint beam across a dark sea',
    tryLine: 'Every line on this cover opens its page.',
    listLabel: 'In this issue',
    lampOn: 'Lamp on',
  },
  letter: {
    section: 'EDITOR’S LETTER',
    kicker: 'EDITOR’S LETTER',
    title: 'Keeping a light on',
    paragraphs: [
      'This issue began with a letter. Nevin Sarıgül wrote to us in the spring to say that her lighthouse was going automatic, and that she would like someone to write it down before it was forgotten. We went in June, and again in September, and both times we stayed until the lamp came on.',
      'Every piece in No. 07 is about a light that somebody keeps: a lamp, a darkroom, a kitchen window at four in the morning. None of them is about the light itself. They are about the people who stay awake for it.',
      'Read slowly. Write in the margins. That is what they are for.',
    ],
    signoff: '**Mira Castell**, editor',
    marginLabel: 'MARGIN NOTES',
    contentsTitle: 'In this issue',
    contents: [
      { page: 'cover', title: 'Cover', dek: 'A lighthouse, a beam, three ways in' },
      { page: 'letter', title: 'Editor’s letter', dek: 'Why this issue keeps a light on' },
      {
        page: 'feature',
        title: 'The last keeper of Cape Ardıç',
        dek: 'Thirty-one years, 112 steps, one lamp',
      },
      { page: 'contact', title: 'Roll three', dek: 'Twelve frames from the lamp room' },
      { page: 'agreement', title: 'Write for us', dek: 'The contributor agreement' },
    ],
    folderTitle: 'From the editor’s folder',
    folder: [
      { page: 'scan', title: 'A letter from the cape', dek: 'Two corrections, typed and scanned' },
      { page: 'invoice', title: 'The printer’s invoice', dek: 'Saltmarsh Press, 1,200 copies' },
      { page: 'flatplan', title: 'Flatplan', dek: 'Every page of No. 07 in order' },
    ],
    folderPhone:
      'Three more pages, a scanned letter, the printer’s invoice and the flatplan, are in the sample on a computer or tablet.',
    note: { author: 'Jonah Pell', text: 'Can the lens photo run bigger on page 3?' },
    tryLine: {
      full: 'Select a sentence and highlight it, or press Ctrl+F (Cmd+F on a Mac) to find a word. The margin is for your Pen (P).',
      phone:
        'Select a sentence and tap Highlight. Then tap Edit and write in the margin with the Pen.',
    },
  },
  feature: {
    section: 'FEATURE',
    kicker: 'FEATURE · LIGHT',
    title: ['The last keeper', 'of Cape Ardıç'],
    deck: 'For thirty-one years, Nevin Sarıgül climbed 112 steps every evening to light the lamp at the end of the cape. In March the light went automatic. She still climbs.',
    byline: 'Words **Defne Aras** · Photographs **Jonah Pell**',
    col1: [
      '**Up in the lamp room** it smells of metal polish and paraffin, though none has burned here since 1987. Nevin Sarıgül opens the window a hand’s width, as she has every evening since she came in 1995 with one suitcase and a cat called Pusula. Below us the sea is the colour of slate, and the first fishing boats are already leaving the harbour.',
      'Her job was easy to describe and hard to do: light the lamp at sunset, wind the clockwork that turns the lens, keep the glass clean, and write everything in the logbook, the wind, the visibility, each passing ship. She did it alone for thirty-one years, through the storms that twice took the roof off the oil store.',
      'In March a small grey box came from the coastal authority. It holds a sensor, a battery and a radio, and it turns the light on by itself when the evening grows dark enough. Nobody has to climb the stairs to the lamp any more.',
      'Nobody, that is, except Nevin. She still goes up at dusk, checks the box has done its work, and writes one line in the logbook. Most nights it is the same line: Light on, all well.',
    ],
    p5: 'The lens is as big as a little room, a beehive of glass prisms that gathers one weak flame and throws it twenty-two nautical miles out to sea. Every Sunday she cleans it with a soft cloth and a bowl of warm water, one prism at a time.',
    quote: '“A lighthouse is a promise that someone is still awake.”',
    p6: 'When I ask whether she minds the box, she laughs. The machine is better at keeping time, she says, but it never notices the weather turning, or a boat that is late home. On those nights she stays up anyway, with the kettle and the radio, till the last boat is in.*',
    caption:
      'The first-order lens, made in 1906, still turns once every ten seconds. Photograph: Jonah Pell',
    footnote:
      '* Cape Ardıç and everyone in this article are fictional, like every name in this sample.',
    logLabel: 'FROM THE LOGBOOK',
    log: [
      '12 September. Wind SW 3, visibility good. Two boats out, two home. Light on at 19:21, all well.',
      '13 September. Fog. One boat late, home at 23:40.',
      '14 September. Clear. Light on at 19:17, all well.',
      '15 September. Rain, then clear. Light on at 19:15, all well.',
    ],
    alt: 'The lighthouse’s first-order lens: rings of glass prisms around a small flame',
    tryLine: {
      full: 'Choose Edit text (E), then any paragraph, to change its words. Put your name in the byline, or add a sentence to the end of the first column and watch it reflow.',
      phone:
        'Tap Edit, then Edit text, then a paragraph. Put your name in the byline, or add a sentence and watch it reflow.',
    },
  },
  contact: {
    section: 'CONTACT SHEET',
    kicker: 'PHOTOGRAPHS · ROLL 3',
    title: 'Inside the lamp room',
    intro:
      'Twelve frames from the September visit, printed as they came off the roll. One of them runs on page 3.',
    instruction: 'Pick one for page 3. — J.P.',
    alt: 'Contact sheet of twelve photographs from the lamp room: the lens, the stair, the logbook, a kettle, the sea, the lamp, the grey box, the keeper’s coat on its hook, the beam, a dog’s bowl, the door at dusk, the empty stair',
    roll: 'MARGIN 07 · ROLL 3',
    notes: 'Notes for the printer',
    tryLine: {
      full: 'Circle the frame you would print with the Pen (P) or an ellipse (O), stamp it Approved, and add a note (N) to say why.',
      phone:
        'Tap Edit and circle the frame you would print with the Pen. Text adds a few words beside it.',
    },
  },
  agreement: {
    section: 'AGREEMENT',
    title: 'Contributor agreement',
    sub: 'Contributors · No. 07',
    terms: [
      'Thank you for writing for Margin. This agreement covers your piece in No. 07. We may print it once in this issue and keep it in our online archive.',
      'Everything else stays yours. You may publish the piece anywhere from 1 January 2027. We pay within 30 days of publication.',
    ],
    cardTitle: 'Your details',
    name: 'Your name',
    date: 'Date',
    email: 'Email',
    feeLabel: 'Your fee',
    feeTransfer: 'Pay my fee of £240 by bank transfer',
    feeTrust: 'Give my fee to the Cape Ardıç Lighthouse Trust',
    consentLabel: 'Your consent',
    agree: 'I have read this agreement and accept it.',
    signature: 'Signature',
    place: 'Place and date',
    tryLine: {
      full: 'Choose a field and type; Tab moves to the next one. Then add your signature on the line with Sign (G).',
      phone:
        'Tap a field and type; › on the bar moves to the next. Then tap Edit, choose Sign, and sign on the line.',
    },
  },
  scan: {
    alt: 'Scanned typed letter from Nevin Sarıgül to Mira Castell, no text layer',
    letter: [
      'The Lighthouse',
      'Cape Ardıç',
      '',
      '29 September 2026',
      '',
      'Dear Mira,',
      '',
      'Thank you for the proofs. Defne has been kinder',
      'to me than the wind was last winter.',
      '',
      'Two small corrections. The lens was made in',
      '1904, not 1906. And Pusula was a dog, not a',
      'cat. She would be offended.',
      '',
      'You asked what I write in the logbook now. Last',
      'night it was: wind NE 4, visibility good, two',
      'boats out, two boats home, lamp on at 18:52.',
      'All well.',
      '',
      'Come in October if you can. The light is best',
      'after the first storm.',
      '',
      'With my regards,',
      '#signature',
      'Nevin Sarıgül',
    ],
    stamp: 'RECEIVED 2 OCT 2026',
    tryLine:
      'Choose Recognize text, then find “1904”. Nevin asks for two corrections: make them on page 3 with Edit text.',
  },
  invoice: {
    section: 'INVOICE',
    printer: 'Saltmarsh Press',
    printerLine: 'Printers since 1961 · 12 Ropewalk Lane, Harrowmere',
    number: 'Invoice 2026-0412',
    date: '15 October 2026',
    billTo: 'Bill to',
    billName: 'Margin, Mira Castell',
    description: 'Description',
    amount: 'Amount',
    rows: [
      ['Printing, Margin No. 07: 1,200 copies, 48 pages, uncoated 100 g/m²', '£2,640.00'],
      ['Cover: 300 g/m², one special colour', '£420.00'],
      ['Proofs, two rounds', '£90.00'],
      ['Delivery to the studio', '£60.00'],
    ],
    totals: [
      ['Subtotal', '£3,210.00'],
      ['VAT 20%', '£642.00'],
      ['Total', '£3,852.00'],
    ],
    payTitle: 'Payment details',
    pay: [
      ['Bank', 'Harrowmere Mutual'],
      ['IBAN', 'GB82 WEST 1234 5698 7654 32'],
      ['Email', 'accounts@saltmarsh-press.example'],
      ['Phone', '+44 7700 900412'],
    ],
    terms: 'Payment within 30 days. Please quote the invoice number.',
    thanks: 'Thank you for printing with us. Proofs and plates are kept for a year.',
    tryLine:
      'Before you forward this invoice, black out the bank details: choose Redact (X), then Find sensitive data, then Apply redactions.',
  },
  flatplan: {
    section: 'FLATPLAN',
    kicker: 'FLATPLAN · NO. 07',
    title: { full: 'Put the issue in order', phone: 'Every page at once' },
    alt: {
      full: 'Miniatures of the eight pages of this sample in order: cover, editor’s letter, feature, contact sheet, agreement, scanned letter, invoice, flatplan',
      phone:
        'Miniatures of the six pages of this sample in order: cover, editor’s letter, feature, contact sheet, agreement, flatplan',
    },
    labels: {
      cover: 'Cover',
      letter: 'Letter',
      feature: 'Feature',
      contact: 'Contact sheet',
      agreement: 'Agreement',
      scan: 'Scan',
      invoice: 'Invoice',
      flatplan: 'Flatplan',
      'flatplan-phone': 'Flatplan',
    },
    noteName: 'Mira:',
    note: {
      full: 'the contact sheet should follow the agreement. Swap 4 and 5?',
      phone: 'the contact sheet should follow the agreement. Swap 4 and 5?',
    },
    keptTitle: 'Kept, then saved',
    lines: {
      full: [
        'Your changes are kept on this device. Save (Ctrl+S; Cmd+S on a Mac) writes them into the file.',
        'Save a copy writes a new file and leaves this one as it is.',
        'Ctrl+K (Cmd+K on a Mac) finds every command: try “compress” or “compare”.',
      ],
      phone: [
        'Pinch any page smaller to see them all. Tap a page to go back into it.',
        'Press and hold a page, then drag it to move it. Select lets you rotate, delete or share pages; Add brings in pages from another file.',
        'Your changes stay on this device. When you are done, choose Save a copy or Share a copy in the menu.',
        'The scanned letter, the invoice and every other tool are in the sample on a computer or tablet.',
      ],
    },
    end: 'That is the whole issue. Open your own PDFs whenever you are ready.',
    lampOff: 'Lamp off',
    tryLine: {
      full: 'Press 3 or choose Pages to see every page, then drag page 4 after page 5. A page’s menu rotates, extracts or deletes it.',
      phone: 'Pinch this page smaller, then press and hold page 4 and drag it after page 5.',
    },
  },
};

const TR: SampleCopy = {
  lang: 'tr',
  title: 'Recto örnek belge',
  subject:
    'Kenar Sayı 07, kurgusal bir derginin baskı haftası dosyası: her sayfa Recto’da deneyebileceğiniz bir şeyi gösterir. Kurgusal veriler.',
  footer: 'Recto örnek belge · kurgusal veriler',
  head: 'KENAR · SAYI 07 · IŞIK',
  tryLabel: 'DENEYİN',
  outline: {
    cover: 'Kapak',
    letter: 'Bir ışığı yanık tutmak',
    feature: 'Ardıç Burnu’nun son bekçisi',
    contact: 'Üçüncü film',
    agreement: 'Yazar sözleşmesi',
    scan: 'Burundan bir mektup',
    invoice: 'Fatura 2026-0412',
    flatplan: 'Sayfa planı',
    'flatplan-phone': 'Sayfa planı',
  },
  cover: {
    tagline: 'Kenarda kalanların üç aylık dergisi',
    masthead: 'Kenar',
    issue: 'SAYI 07 · IŞIK · SONBAHAR 2026',
    lines: [
      {
        page: 'feature',
        title: 'Ardıç Burnu’nun son bekçisi',
        dek: 'Otuz bir yıl, 112 basamak, tek bir fener',
      },
      {
        page: 'contact',
        title: 'Üçüncü film',
        dek: 'Fener odasının içi: Jonah Pell’den on iki kare',
      },
      { page: 'agreement', title: 'Bizim için yazın', dek: 'Yazar sözleşmesi' },
    ],
    linkPrefix: 'sayfaya git',
    alt: 'Gece, karanlık denizin üzerine limon yeşili ve nane rengi bir ışık huzmesi düşüren bir deniz feneri',
    tryLine: 'Bu kapaktaki her satır kendi sayfasını açar.',
    listLabel: 'Bu sayıda',
    lampOn: 'Fener yandı',
  },
  letter: {
    section: 'EDİTÖRDEN',
    kicker: 'EDİTÖRDEN',
    title: 'Bir ışığı yanık tutmak',
    paragraphs: [
      'Bu sayı bir mektupla başladı. Nevin Sarıgül ilkbaharda bize yazdı: feneri otomatiğe geçecekti ve unutulmadan önce birinin bunu yazmasını istiyordu. Haziranda gittik, eylülde yine gittik; ikisinde de fener yanana kadar kaldık.',
      '07. sayıdaki her yazı, birinin yanık tuttuğu bir ışığı anlatıyor: bir fener, bir karanlık oda, sabahın dördünde bir mutfak penceresi. Hiçbiri ışığın kendisiyle ilgili değil; hepsi onun için uyanık kalan insanlarla ilgili.',
      'Yavaş okuyun. Kenarlara yazın. Kenarlar bunun için var.',
    ],
    signoff: '**Mira Castell**, editör',
    marginLabel: 'KENAR NOTLARI',
    contentsTitle: 'Bu sayıda',
    contents: [
      { page: 'cover', title: 'Kapak', dek: 'Bir fener, bir ışık, üç giriş' },
      { page: 'letter', title: 'Editörden', dek: 'Bu sayı neden bir ışığı yanık tutuyor' },
      {
        page: 'feature',
        title: 'Ardıç Burnu’nun son bekçisi',
        dek: 'Otuz bir yıl, 112 basamak, tek bir fener',
      },
      { page: 'contact', title: 'Üçüncü film', dek: 'Fener odasından on iki kare' },
      { page: 'agreement', title: 'Bizim için yazın', dek: 'Yazar sözleşmesi' },
    ],
    folderTitle: 'Editörün dosyasından',
    folder: [
      {
        page: 'scan',
        title: 'Burundan bir mektup',
        dek: 'İki düzeltme, daktiloyla yazılıp taranmış',
      },
      { page: 'invoice', title: 'Matbaanın faturası', dek: 'Saltmarsh Press, 1.200 adet' },
      { page: 'flatplan', title: 'Sayfa planı', dek: '07. sayının bütün sayfaları sırayla' },
    ],
    folderPhone:
      'Üç sayfa daha, taranmış bir mektup, matbaanın faturası ve sayfa planı, bilgisayar ve tabletteki örnek belgede.',
    note: { author: 'Jonah Pell', text: 'Mercek fotoğrafı 3. sayfada daha büyük basılabilir mi?' },
    tryLine: {
      full: 'Bir cümleyi seçip vurgulayın ya da bir sözcüğü bulmak için Ctrl+F’ye (Mac’te Cmd+F) basın. Kenar boşluğu Kalem (P) içindir.',
      phone:
        'Bir cümle seçip Vurgula’ya dokunun. Ardından Düzenle’ye dokunun ve Kalem ile kenar boşluğuna yazın.',
    },
  },
  feature: {
    section: 'DOSYA',
    kicker: 'DOSYA · IŞIK',
    title: ['Ardıç Burnu’nun', 'son bekçisi'],
    deck: 'Nevin Sarıgül otuz bir yıl boyunca her akşam 112 basamak çıkıp burnun ucundaki feneri yaktı. Martta fener otomatiğe geçti. Ama o hâlâ çıkıyor.',
    byline: 'Yazı **Defne Aras** · Fotoğraf **Jonah Pell**',
    col1: [
      '**Fener odası** pirinç cilası ve gaz yağı kokuyor, oysa burada 1987’den beri hiç gaz yağı yanmadı. Nevin Sarıgül pencereyi bir karış aralıyor; 1995’te tek bir bavul ve Pusula adında bir kediyle geldiğinden beri her akşam yaptığı gibi. Aşağıda deniz arduvaz gibi gri, ilk balıkçı tekneleri limandan çıkmış bile.',
      'Yaptığı işi anlatmak kolay, yapmak zordu: güneş batarken lambayı yakmak, merceği döndüren saat mekanizmasını kurmak, camı temiz tutmak ve her şeyi nöbet defterine işlemek; rüzgârı, görüşü, geçen her gemiyi. Otuz bir yıl bunu tek başına yaptı, yağ deposunun çatısını iki kez uçuran fırtınalarda bile.',
      'Martta sahil idaresinden küçük gri bir kutu geldi. İçinde bir algılayıcı, bir pil ve bir telsiz var; akşam yeterince karardığında ışığı kendi kendine yakıyor. Artık kimsenin merdivenleri çıkması gerekmiyor.',
      'Nevin dışında kimsenin. O ise hâlâ gün batarken çıkıyor, kutunun işini yaptığını görüyor ve deftere tek bir satır yazıyor. Çoğu gece hep aynı satırı: Işık yandı, her şey yolunda.',
    ],
    p5: 'Fenerin merceği küçük bir oda büyüklüğünde; tek bir alevi toplayıp yirmi iki deniz mili açığa fırlatan cam prizmalardan bir arı kovanı. Her pazar sabahı onu yumuşak bir bez ve bir kâse ılık suyla, prizma prizma temizliyor.',
    quote: '“Fener, birinin hâlâ uyanık olduğuna dair bir sözden ibarettir.”',
    p6: 'Kutuya kızıp kızmadığını sorunca gülüyor. Makine zamanı ondan iyi tutuyormuş, diyor; ama havanın döndüğünü ve eve geç kalan bir tekneyi göremiyor. Böyle gecelerde demliği ve telsiziyle yine de uyanık kalıyor, son tekne limana girene dek.*',
    caption:
      '1906’da yapılan birinci derece mercek hâlâ on saniyede bir tur atıyor. Fotoğraf: Jonah Pell',
    footnote:
      '* Ardıç Burnu ve bu yazıdaki herkes kurgusaldır; bu örnek belgedeki bütün adlar gibi.',
    logLabel: 'NÖBET DEFTERİNDEN',
    log: [
      '12 Eylül. Rüzgâr GB 3, görüş iyi. İki tekne çıktı, iki tekne döndü. Işık 19.21’de yandı, her şey yolunda.',
      '13 Eylül. Sis. Bir tekne geç kaldı, 23.40’ta döndü.',
      '14 Eylül. Açık hava. Işık 19.17’de yandı, her şey yolunda.',
      '15 Eylül. Yağmur, sonra açık. Işık 19.15’te yandı, her şey yolunda.',
    ],
    alt: 'Fenerin birinci derece merceği: küçük bir alevin çevresinde cam prizma halkaları',
    tryLine: {
      full: 'Metni düzenle’yi (E), ardından bir paragrafı seçip sözcüklerini değiştirin. Künyeye kendi adınızı yazın ya da ilk sütunun sonuna bir cümle ekleyip metnin yeniden dizilişini izleyin.',
      phone:
        'Düzenle’de Metni düzenle’yi seçip bir paragrafa dokunun. Künyeye adınızı yazın ya da cümle ekleyip akışı izleyin.',
    },
  },
  contact: {
    section: 'TEMAS BASKISI',
    kicker: 'FOTOĞRAFLAR · FİLM 3',
    title: 'Fener odasının içi',
    intro:
      'Eylül ziyaretinden on iki kare, filmden çıktıkları gibi basıldı. Biri 3. sayfada yayımlanacak.',
    instruction: '3. sayfa için birini seçin. — J.P.',
    alt: 'Fener odasından on iki fotoğraflık temas baskısı: mercek, merdiven, nöbet defteri, bir çaydanlık, deniz, lamba, gri kutu, bekçinin askıdaki ceketi, ışık huzmesi, bir köpek kabı, alacakaranlıkta kapı, boş merdiven',
    roll: 'KENAR 07 · FİLM 3',
    notes: 'Matbaaya notlar',
    tryLine: {
      full: 'Basılacak kareyi Kalem (P) ya da elips (O) ile daire içine alın, Onaylandı damgası vurun ve nedenini bir notla (N) yazın.',
      phone:
        'Düzenle’ye dokunun ve basılacak kareyi Kalem ile daire içine alın. Metin, yanına birkaç sözcük eklemenizi sağlar.',
    },
  },
  agreement: {
    section: 'SÖZLEŞME',
    title: 'Yazar sözleşmesi',
    sub: 'Yazarlar · Sayı 07',
    terms: [
      'Kenar’a yazdığınız için teşekkür ederiz. Bu sözleşme, 07. sayıdaki yazınızı kapsar. Yazınızı bu sayıda bir kez basabilir ve çevrimiçi arşivimizde tutabiliriz.',
      'Diğer bütün haklar sizde kalır. Yazınızı 1 Ocak 2027’den itibaren dilediğiniz yerde yayımlayabilirsiniz. Ücretinizi yayından sonraki 30 gün içinde öderiz.',
    ],
    cardTitle: 'Bilgileriniz',
    name: 'Adınız soyadınız',
    date: 'Tarih',
    email: 'E-posta',
    feeLabel: 'Ücretiniz',
    feeTransfer: '8.400 ₺ ücretimi banka havalesiyle ödeyin',
    feeTrust: 'Ücretimi Ardıç Burnu Feneri Vakfı’na bağışlayın',
    consentLabel: 'Onayınız',
    agree: 'Bu sözleşmeyi okudum ve kabul ediyorum.',
    signature: 'İmza',
    place: 'Yer ve tarih',
    tryLine: {
      full: 'Bir alanı seçip yazın; Sekme tuşu sonrakine geçer. Ardından İmzala (G) ile çizginin üzerine imzanızı ekleyin.',
      phone:
        'Bir alana dokunup yazın; çubuktaki › sonrakine geçer. Sonra Düzenle’de İmza’yı seçip çizginin üzerine imzanızı atın.',
    },
  },
  scan: {
    alt: 'Nevin Sarıgül’ün Mira Castell’e daktiloyla yazdığı taranmış mektup, metin katmanı yok',
    letter: [
      'Fener Evi',
      'Ardıç Burnu',
      '',
      '29 Eylül 2026',
      '',
      'Sevgili Mira,',
      '',
      'Provalar için teşekkür ederim. Defne bana geçen',
      'kışın rüzgârından çok daha nazik davrandı.',
      '',
      'İki küçük düzeltme var. Mercek 1906’da değil,',
      '1904’te yapıldı. Pusula da kedi değil, köpekti.',
      'Duysa gücenirdi.',
      '',
      'Nöbet defterine artık ne yazdığımı sormuşsunuz.',
      'Dün akşam şunu yazdım: rüzgâr KD 4, görüş iyi,',
      'iki tekne çıktı, iki tekne döndü, fener 18.52’de',
      'yandı. Her şey yolunda.',
      '',
      'Fırsat bulursanız ekimde gelin. Işık en güzel',
      'ilk fırtınadan sonra olur.',
      '',
      'Saygılarımla,',
      '#signature',
      'Nevin Sarıgül',
    ],
    stamp: 'ALINDI 2 EKİM 2026',
    tryLine:
      'Metni tanı’yı seçin, ardından “1904”ü bulun. Nevin iki düzeltme istiyor: bunları 3. sayfada Metni düzenle ile yapın.',
  },
  invoice: {
    section: 'FATURA',
    printer: 'Saltmarsh Press',
    printerLine: '1961’den beri matbaa · 12 Ropewalk Lane, Harrowmere',
    number: 'Fatura 2026-0412',
    date: '15 Ekim 2026',
    billTo: 'Fatura adresi',
    billName: 'Kenar, Mira Castell',
    description: 'Açıklama',
    amount: 'Tutar',
    rows: [
      ['Baskı, Kenar Sayı 07: 1.200 adet, 48 sayfa, kuşesiz 100 g/m²', '92.400,00 ₺'],
      ['Kapak: 300 g/m², tek özel renk', '14.700,00 ₺'],
      ['Provalar, iki tur', '3.150,00 ₺'],
      ['Stüdyoya teslimat', '2.100,00 ₺'],
    ],
    totals: [
      ['Ara toplam', '112.350,00 ₺'],
      ['KDV %20', '22.470,00 ₺'],
      ['Toplam', '134.820,00 ₺'],
    ],
    payTitle: 'Ödeme bilgileri',
    pay: [
      ['Banka', 'Harrowmere Mutual'],
      ['IBAN', 'TR33 0006 1005 1978 6457 8413 26'],
      ['E-posta', 'accounts@saltmarsh-press.example'],
      ['Telefon', '+90 212 000 04 12'],
    ],
    terms: 'Ödeme 30 gün içindedir. Lütfen fatura numarasını belirtin.',
    thanks: 'Bizimle bastığınız için teşekkür ederiz. Provalar ve kalıplar bir yıl saklanır.',
    tryLine:
      'Bu faturayı iletmeden önce banka bilgilerini karartın: Karart’ı (X), ardından Hassas verileri bul’u, sonra Karartmaları uygula’yı seçin.',
  },
  flatplan: {
    section: 'SAYFA PLANI',
    kicker: 'SAYFA PLANI · SAYI 07',
    title: { full: 'Sayıyı sıraya koyun', phone: 'Bütün sayfalar bir arada' },
    alt: {
      full: 'Bu örnek belgenin sekiz sayfasının sırayla küçük resimleri: kapak, editörden, dosya, temas baskısı, sözleşme, taranmış mektup, fatura, sayfa planı',
      phone:
        'Bu örnek belgenin altı sayfasının sırayla küçük resimleri: kapak, editörden, dosya, temas baskısı, sözleşme, sayfa planı',
    },
    labels: {
      cover: 'Kapak',
      letter: 'Editörden',
      feature: 'Dosya',
      contact: 'Temas baskısı',
      agreement: 'Sözleşme',
      scan: 'Mektup',
      invoice: 'Fatura',
      flatplan: 'Sayfa planı',
      'flatplan-phone': 'Sayfa planı',
    },
    noteName: 'Mira:',
    note: {
      full: 'temas baskısı sözleşmeden sonra gelmeli. 4 ile 5’in yerini değiştirelim mi?',
      phone: 'temas baskısı sözleşmeden sonra gelmeli. 4 ile 5’in yerini değiştirelim mi?',
    },
    keptTitle: 'Önce saklanır, sonra kaydedilir',
    lines: {
      full: [
        'Değişiklikleriniz bu cihazda saklanır. Kaydet (Ctrl+S, Mac’te Cmd+S) onları dosyaya yazar.',
        'Kopya kaydet yeni bir dosya yazar, bu dosyayı olduğu gibi bırakır.',
        'Ctrl+K (Mac’te Cmd+K) her komutu bulur: “sıkıştır” ya da “karşılaştır” yazmayı deneyin.',
      ],
      phone: [
        'Bütün sayfaları görmek için bir sayfayı iki parmağınızla küçültün; geri dönmek için bir sayfaya dokunun.',
        'Bir sayfayı taşımak için basılı tutup sürükleyin. Seç ile sayfaları döndürebilir, silebilir ya da paylaşabilirsiniz; Ekle, başka bir dosyadan sayfa getirir.',
        'Değişiklikleriniz bu cihazda kalır. Bitince menüden Kopya kaydet’i ya da Kopyasını paylaş’ı seçin.',
        'Taranmış mektup, fatura ve diğer bütün araçlar bilgisayar ve tabletteki örnek belgede.',
      ],
    },
    end: 'Sayı bu kadar. Hazır olduğunuzda kendi PDF’lerinizi açın.',
    lampOff: 'Fener söndü',
    tryLine: {
      full: 'Bütün sayfaları görmek için 3’e basın ya da Sayfalar’ı seçin, sonra 4. sayfayı 5. sayfanın arkasına sürükleyin. Bir sayfanın menüsü onu döndürür, ayıklar ya da siler.',
      phone:
        'Bu sayfayı iki parmağınızla küçültün, sonra 4. sayfayı basılı tutup 5. sayfanın arkasına sürükleyin.',
    },
  },
};

export const COPY: Record<SampleLocale, SampleCopy> = { en: EN, tr: TR };
