// Dates in zip file entries are stored as DosDateTime
// Spec is here: https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-dosdatetimetofiletime

module.exports = function parseDateTime(date, time) {
  const day = date & 0x1F;
  const month = date >> 5 & 0x0F;
  const year = (date >> 9 & 0x7F) + 1980;
  const seconds = time ? (time & 0x1F) * 2 : 0;
  const minutes = time ? (time >> 5) & 0x3F : 0;
  const hours = time ? (time >> 11): 0;

  return new Date(Date.UTC(year, month-1, day, hours, minutes, seconds));
};