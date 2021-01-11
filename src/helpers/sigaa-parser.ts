import { decode as htmlEntitiesDecode } from 'he';

/**
 * Text sanitizer and date parser.
 * @category Internal
 */
export interface Parser {
  /**
   * Return all dates in strings
   */
  parseDates(string: string, numberOfDates: number, year?: number): Date[];
  /**
   * Remove *ALL* html tags
   * Clears text by removing all HTML tags and fix encoding characters
   */
  removeTagsHtml(html?: string | null): string;

  /**
   * Keep tags safe only
   */
  removeTagsHtmlKeepingEmphasis(html?: string | null): string;
}

/**
 * @category Internal
 */
export class SigaaParser implements Parser {
  private toFullYear(year: string): string {
    if (year.length !== 2) return year;
    const parsedYear = parseInt(year, 10);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentCentury = Math.trunc(currentYear / 100);
    if (currentYear + 10 > parsedYear) {
      return (parsedYear + currentCentury * 100).toString();
    }
    return (parsedYear + (currentCentury - 1) * 100).toString();
  }

  /**
   * @inheritdoc
   */
  private createDateFromString(
    dataString: string,
    timeString = '00:00',
    year?: number
  ): Date {
    const dateSplited = dataString.match(/[0-9]+/g);
    const timeSplited = timeString.match(/[0-9]+/g);
    if (
      timeSplited &&
      timeSplited.length >= 2 &&
      dateSplited &&
      dateSplited.length >= 2
    ) {
      const dateYear = dateSplited[2]
        ? this.toFullYear(dateSplited[2])
        : year || new Date().getFullYear();
      const month = dateSplited[1];
      const day = dateSplited[0];
      const hour = ('0' + timeSplited[0]).substr(-2);
      const minutes = ('0' + timeSplited[1]).substr(-2);
      const seconds = timeSplited[2] ? ('0' + timeSplited[2]).substr(-2) : '00';
      const date = new Date(
        `${dateYear}-${month}-${day}T${hour}:${minutes}:${seconds}.000`
      );
      if (isNaN(date.valueOf())) throw new Error('SIGAA: Invalid date.');
      return date;
    }
    throw new Error('SIGAA: Invalid date string.');
  }

  /**
   * Parse all dates in dateString in format dd/mm/yy, dd/mm/yy hh:mm, dd/mm/yy hh'h'mm
   * @param dateString String to parse
   * @return {Date[]} Dates found in string
   */
  parseDates(dateString: string, numberOfDates: number, year?: number): Date[] {
    const dateStrings =
      dateString.match(
        /[\d]{2}\/[\d]{2}(\/[\d]{2}([\d]{2})?)?|[\d][\d]?[\s]*?([:h]|horas)[\s]*?[\d]{2}([\s]*?(:|min|mim)([\s]*?)[\d]{2})?/g
      ) || [];
    const dates: Date[] = [];
    let currentDate;
    for (let i = 0; i < dateStrings.length; i++) {
      if (dateStrings[i].includes('/')) {
        currentDate = dateStrings[i];
        if (
          dateStrings[i + 1] &&
          (dateStrings[i + 1].includes(':') || dateStrings[i + 1].includes('h'))
        ) {
          dates.push(
            this.createDateFromString(dateStrings[i], dateStrings[i + 1], year)
          );
          i++;
          continue;
        } else {
          dates.push(
            this.createDateFromString(dateStrings[i], undefined, year)
          );
          continue;
        }
      }
      if (
        currentDate &&
        (dateStrings[i].includes(':') || dateStrings[i].includes('h'))
      ) {
        dates.push(
          this.createDateFromString(currentDate, dateStrings[i], year)
        );
      }
    }
    if (numberOfDates != dates.length)
      throw new Error('SIGAA: Number of dates is different than expected.');

    return dates;
  }

  /**
   * @inheritdoc
   */
  removeTagsHtml(html?: string | null): string {
    if (!html) return '';
    try {
      const removeTags = [
        {
          pattern: ['span', 'em', 'b', 'i', 'strong'], // remove without add space
          replacement: ''
        }
      ];
      const replacesBeforeParseHTMLCharacters = [
        {
          pattern: /\n|\xA0|\t/g, // match tabs, break lines, etc
          replacement: ' '
        },
        {
          pattern: /&middot;/g, // replace middle dot with \n and middle dot
          replacement: '\n&middot;'
        },
        {
          pattern: /<\/li>|<\/p>|<br\/>|<br>|<br \/>/gm, //tags to replace with \n
          replacement: '\n'
        }
      ];
      const replacesAfterParseHTMLCharacters = [
        {
          pattern: new RegExp(String.fromCharCode(160), 'g'), // replace NBSP with space
          replacement: ' '
        },
        {
          pattern: / + /gm, //removes multiple whitespaces
          replacement: ' '
        },
        {
          pattern: /^(\s)*|(\s)*$/g, //remove whitespace from beginning and end of text
          replacement: ''
        },
        {
          pattern: /^([ \t])*|([ \t])*$/gm, //remove whitespace from beginning and end line by line
          replacement: ''
        }
      ];

      let newText = html;
      for (const replace of removeTags) {
        for (const tag of replace.pattern) {
          newText = newText.replace(
            new RegExp(`<${tag}>|<${tag} [\\s\\S]*?>|</${tag}>`, 'g'),
            replace.replacement
          );
        }
      }
      for (const replace of replacesBeforeParseHTMLCharacters) {
        newText = newText.replace(replace.pattern, replace.replacement);
      }

      const tagRegex = /<script([\S\s]*?)>([\S\s]*?)<\/script>|<!--([\S\s]*?)-->|<style([\S\s]*?)style>|<[^>]+>|\t/gm;
      while (tagRegex.test(newText)) {
        newText = newText.replace(tagRegex, ' ');
      }

      newText = htmlEntitiesDecode(newText);

      for (const replace of replacesAfterParseHTMLCharacters) {
        newText = newText.replace(replace.pattern, replace.replacement);
      }
      const spaces = (newText.match(/\n+/g) || [])
        .filter((item, index, array) => array.indexOf(item) == index)
        .sort()
        .filter((item, index) => item.length !== index + 1)
        .reverse();

      for (let i = 0; i < spaces.length; i++) {
        const currentSpaces = spaces[i];
        const newSpacesCount = spaces.length - i;
        let newSpaces = '';
        for (let count = 0; count < newSpacesCount; count++) {
          newSpaces += '\n';
        }
        const regExCurrentSpaces = new RegExp(currentSpaces, 'g');
        newText = newText.replace(regExCurrentSpaces, newSpaces);
      }

      return newText.trim();
    } catch (err) {
      return '';
    }
  }

  /**
   * Fix encoding characters and clears text by removing all HTML tags except strong, em, b and i
   */
  removeTagsHtmlKeepingEmphasis(text?: string | null): string {
    if (!text) return '';
    try {
      const keepTags = ['b', 'i', 'strong', 'em', 'li', 'ul', 'ol'];
      let newText = text;
      for (const tag of keepTags) {
        const openTagReg = new RegExp(`<\\b${tag}\\b[\\s\\S]*?>+?`, 'g');
        const closeTagReg = new RegExp(`<\\/\\b${tag}\\b[\\s\\S]*?>+?`, 'g');
        newText = newText.replace(openTagReg, `&lt;${tag}&gt;`);
        newText = newText.replace(closeTagReg, `&lt;/${tag}&gt;`);
      }
      return this.removeTagsHtml(newText);
    } catch (err) {
      return '';
    }
  }
}
