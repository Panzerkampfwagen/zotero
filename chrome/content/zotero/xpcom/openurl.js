/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.OpenURL = new function() {
	this.resolve = resolve;
	this.discoverResolvers = discoverResolvers;
	this.createContextObject = createContextObject;
	this.parseContextObject = parseContextObject;
	
	/*
	 * Returns a URL to look up an item in the OpenURL resolver
	 */
	function resolve(itemObject) {
		var co = createContextObject(itemObject, Zotero.Prefs.get("openURL.version"));
		if(co) {
			var base = Zotero.Prefs.get("openURL.resolver");
			// Add & if there's already a ?
			var splice = base.indexOf("?") == -1 ? "?" : "&";
			return base + splice + co;
		}
		return false;
	}
	
	/*
	 * Queries OCLC's OpenURL resolver registry and returns an address and version
	 */
	function discoverResolvers() {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
		req.open("GET", "http://worldcatlibraries.org/registry/lookup?IP=requestor", false);
		req.send(null);
		
		if(!req.responseXML) {
			throw "Could not access resolver registry";
		}
		
		var resolverArray = new Array();
		var resolvers = req.responseXML.getElementsByTagName("resolver");
		for(var i=0; i<resolvers.length; i++) {
			var resolver = resolvers[i];
			
			var name = resolver.parentNode.getElementsByTagName("institutionName");
			if(!name.length) {
				continue;
			}
			name = name[0].textContent;
			
			var url = resolver.getElementsByTagName("baseURL");
			if(!url.length) {
				continue;
			}
			url = url[0].textContent;
			
			if(resolver.getElementsByTagName("Z39.88-2004").length > 0) {
				var version = "1.0";
			} else if(resolver.getElementsByTagName("OpenUrl 0.1").length > 0) {
				var version = "0.1";
			} else {
				continue;
			}
			
			resolverArray.push({name:name, url:url, version:version});
		}
		
		return resolverArray;
	}
	
	/*
	 * Generates an OpenURL ContextObject from an item
	 */
	function createContextObject(item, version) {
		if(item.toArray) {
			item = item.toArray();
		}
		
		var identifiers = new Array();
		if(item.DOI) {
			identifiers.push("info:doi/"+item.DOI);
		}
		if(item.ISBN) {
			identifiers.push("urn:isbn:"+item.ISBN);
		}
		
		// encode ctx_ver (if available) and identifiers
		// TODO identifiers may need to be encoded as follows:
		// rft_id=info:doi/<the-url-encoded-doi>
		// rft_id=http://<the-rest-of-the-url-encoded-url>
		if(version == "0.1") {
			var co = "sid=Zotero:"+encodeURIComponent(Zotero.version);
			
			for(var i=0; i<identifiers.length; i++) {
				co += "&id="+encodeURIComponent(identifiers[i]);
			}
		} else {
			var co = "url_ver=Z39.88-2004&ctx_ver=Z39.88-2004"+
				     "&rfr_id="+encodeURIComponent("info:sid/zotero.org:"+Zotero.version);
			
			for(var i=0; i<identifiers.length; i++) {
				co += "&rft_id="+encodeURIComponent(identifiers[i])
			}
		}
		
		// encode genre and item-specific data
		if(item.itemType == "journalArticle") {
			if(version == "0.1") {
				co += "&genre=article";
			} else {
				co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal&rft.genre=article";
			}
			if(item.title) co += _mapTag(item.title, "atitle", version)		
			if(item.publicationTitle) co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "jtitle"), version)		
			if(item.journalAbbreviation) co += _mapTag(item.journalAbbreviation, "stitle", version);
			if(item.volume) co += _mapTag(item.volume, "volume", version);
			if(item.issue) co += _mapTag(item.issue, "issue", version);
		} else if(item.itemType == "book" || item.itemType == "bookSection") {
			if(version == "0.1") {
				co += "&genre=book";
			} else {
				co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook";
			}
			
			if(item.itemType == "book") {
				co += "&rft.genre=book";
				if(item.title) co += _mapTag(item.title, (version == "0.1" ? "title" : "btitle"), version);
			} else {
				co += "&rft.genre=bookitem";
				if(item.title) co += _mapTag(item.title, "atitle", version)		
				if(item.publicationTitle) co += _mapTag(item.publicationTitle, (version == "0.1" ? "title" : "btitle"), version);
			}
			
			if(item.place) co += _mapTag(item.place, "place", version);
			if(item.publisher) co += _mapTag(item.publisher, "publisher", version)		
			if(item.edition) co += _mapTag(item.edition, "edition", version);
			if(item.series) co += _mapTag(item.series, "series", version);
		} else if(item.itemType == "thesis" && version == "1.0") {
			co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Adissertation";
			
			if(item.title) co += _mapTag(item.title, "title", version);
			if(item.publisher) co += _mapTag(item.publisher, "inst", version);
			if(item.type) co += _mapTag(item.type, "degree", version);
		} else if(item.itemType == "patent" && version == "1.0") {
			co += "&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Apatent";
			
			if(item.title) co += _mapTag(item.title, "title", version);
			if(item.assignee) co += _mapTag(item.assignee, "assignee", version);
			if(item.patentNumber) co += _mapTag(item.patentNumber, "number", version);
			
			if(item.issueDate) {
				co += _mapTag(Zotero.Date.strToISO(item.issueDate), "date", version);
			}
		} else {
			return false;
		}
		
		if(item.creators && item.creators.length) {
			// encode first author as first and last
			var firstCreator = item.creators[0];
			if(item.itemType == "patent") {
				co += _mapTag(firstCreator.firstName, "invfirst", version);
				co += _mapTag(firstCreator.lastName, "invlast", version);
			} else {
				if(firstCreator.isInstitution) {
					co += _mapTag(firstCreator.lastName, "aucorp", version);
				} else {
					co += _mapTag(firstCreator.firstName, "aufirst", version);
					co += _mapTag(firstCreator.lastName, "aulast", version);
				}
			}
			
			// encode subsequent creators as au
			for(var i=0; i<identifiers.length; i++) {
				co += _mapTag((creators[i].firstName ? creators[i].firstName+" " : "")+creators[i].lastName, (item.itemType == "patent" ? "inventor" : "au"), version);
			}
		}
		
		if(item.date) {
			co += _mapTag(Zotero.Date.strToISO(item.date), (item.itemType == "patent" ? "appldate" : "date"), version);
		}
		if(item.pages) co += _mapTag(item.pages, "pages", version);
		if(item.ISBN) co += _mapTag(item.ISBN, "isbn", version);
		if(item.ISSN) co += _mapTag(item.ISSN, "issn", version);
		
		return co;
	}
	
	/*
	 * Generates an item in the format returned by item.fromArray() given an
	 * OpenURL version 1.0 contextObject
	 *
	 * accepts an item array to fill, or creates and returns a new item array
	 */
	function parseContextObject(co, item) {
		if(!item) {
			var item = new Array();
			item.creators = new Array();
		}
		
		var coParts = co.split("&");
		
		// get type
		for(var i=0; i<coParts.length; i++) {
			if(coParts[i].substr(0, 12) == "rft_val_fmt=") {
				var format = decodeURIComponent(coParts[i].substr(12));
				if(format == "info:ofi/fmt:kev:mtx:journal") {
					item.itemType = "journalArticle";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:book") {
					if(coParts.indexOf("rft.genre=bookitem") !== -1) {
						item.itemType = "bookSection";
					} else if(coParts.indexOf("rft.genre=conference") !== -1 || coParts.indexOf("rft.genre=proceeding") !== -1) {
						item.itemType = "conferencePaper";
					} else if(coParts.indexOf("rft.genre=report") !== -1) {
						item.itemType = "report";
					} else {
						item.itemType = "book";
					}
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:dissertation") {
					item.itemType = "thesis";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:patent") {
					item.itemType = "patent";
					break;
				} else if(format == "info:ofi/fmt:kev:mtx:dc") {
					item.itemType = "webpage";
					break;
				}
			}
		}
		if(!item.itemType) {
			return false;
		}
		
		var pagesKey = "";
		
		// keep track of "aucorp," "aufirst," "aulast"
		var complexAu = new Array();
		
		for(var i=0; i<coParts.length; i++) {
			var keyVal = coParts[i].split("=");
			var key = keyVal[0];
			var value = decodeURIComponent(keyVal[1].replace(/\+|%2[bB]/g, " "));
			if(!value) {
				continue;
			}
			
			if(key == "rft_id") {
				var firstEight = value.substr(0, 8).toLowerCase();
				if(firstEight == "info:doi") {
					item.DOI = value.substr(9);
				} else if(firstEight == "urn:isbn") {
					item.ISBN = value.substr(9);
				} else if(value.match(/^https?:\/\//)) {
					item.url = value;
					item.accessDate = "";
				}
			} else if(key == "rft.btitle") {
				if(item.itemType == "book" || item.itemType == "conferencePaper" || item.itemType == "report") {
					item.title = value;
				} else if(item.itemType == "bookSection") {
					item.publicationTitle = value;
				}
			} else if(key == "rft.atitle" && (item.itemType == "journalArticle" ||
			                                  item.itemType == "bookSection")) {
				item.title = value;
			} else if(key == "rft.jtitle" && item.itemType == "journalArticle") {
				item.publicationTitle = value;
			} else if(key == "rft.stitle" && item.itemType == "journalArticle") {
				item.journalAbbreviation = value;
			} else if(key == "rft.title") {
				if(item.itemType == "journalArticle" || item.itemType == "bookSection") {
					item.publicationTitle = value;
				} else {
					item.title = value;
				}
			} else if(key == "rft.date") {
				if(item.itemType == "patent") {
					item.issueDate = value;
				} else {
					item.date = value;
				}
			} else if(key == "rft.volume") {
				item.volume = value;
			} else if(key == "rft.issue") {
				item.issue = value;
			} else if(key == "rft.pages") {
				pagesKey = key;
				item.pages = value;
			} else if(key == "rft.spage") {
				if(pagesKey != "rft.pages") {
					// make pages look like start-end
					if(pagesKey == "rft.epage") {
						if(value != item.pages) {
							item.pages = value+"-"+item.pages;
						}
					} else {
						item.pages = value;
					}
					pagesKey = key;
				}
			} else if(key == "rft.epage") {
				if(pagesKey != "rft.pages") {
					// make pages look like start-end
					if(pagesKey == "rft.spage") {
						if(value != item.pages) {
							item.pages = item.pages+"-"+value;
						}
					} else {
						item.pages = value;
					}
					pagesKey = key;
				}
			} else if(key == "rft.issn" || (key == "rft.eissn" && !item.ISSN)) {
				item.ISSN = value;
			} else if(key == "rft.aulast" || key == "rft.invlast") {
				var lastCreator = complexAu[complexAu.length-1];
				if(complexAu.length && !lastCreator.lastName && !lastCreator.institutional) {
					lastCreator.lastName = value;
				} else {
					complexAu.push({lastName:value, creatorType:(key == "rft.aulast" ? "author" : "inventor")});
				}
			} else if(key == "rft.aufirst" || key == "rft.invfirst") {
				var lastCreator = complexAu[complexAu.length-1];
				if(complexAu.length && !lastCreator.firstName && !lastCreator.institutional) {
					lastCreator.firstName = value;
				} else {
					complexAu.push({firstName:value, creatorType:(key == "rft.aufirst" ? "author" : "inventor")});
				}
			} else if(key == "rft.au" || key == "rft.creator" || key == "rft.contributor" || key == "rft.inventor") {
				if(key == "rft.contributor") {
					var type = "contributor";
				} else if(key == "rft.inventor") {
					var type = "inventor";
				} else {
					var type = "author";
				}
				
				if(value.indexOf(",") !== -1) {
					item.creators.push(Zotero.Utilities.cleanAuthor(value, type, true));
				} else {
					item.creators.push(Zotero.Utilities.cleanAuthor(value, type, false));
				}
			} else if(key == "rft.aucorp") {
				complexAu.push({lastName:value, isInstitution:true});
			} else if(key == "rft.isbn" && !item.ISBN) {
				item.ISBN = value;
			} else if(key == "rft.pub" || key == "rft.publisher") {
				item.publisher = value;
			} else if(key == "rft.place") {
				item.place = value;
			} else if(key == "rft.edition") {
				item.edition = value;
			} else if(key == "rft.series") {
				item.series = value;
			} else if(item.itemType == "thesis") {
				if(key == "rft.inst") {
					item.publisher = value;
				} else if(key == "rft.degree") {
					item.type = value;
				}
			} else if(item.itemType == "patent") {
				if(key == "rft.assignee") {
					item.assignee = value;
				} else if(key == "rft.number") {
					item.patentNumber = value;
				} else if(key == "rft.appldate") {
					item.date = value;
				}
			} else if(format == "info:ofi/fmt:kev:mtx:dc") {
				if(key == "rft.identifier") {
					if(value.length > 8) {	// we could check length separately for
											// each type, but all of these identifiers
											// must be > 8 characters
						if(value.substr(0, 5) == "ISBN ") {
							item.ISBN = value.substr(5);
						} else if(value.substr(0, 5) == "ISSN ") {
							item.ISSN = value.substr(5);
						} else if(value.substr(0, 8) == "urn:doi:") {
							item.DOI = value.substr(4);
						} else if(value.substr(0, 7) == "http://" || value.substr(0, 8) == "https://") {
							item.url = value;
						}
					}
				} else if(key == "rft.description") {
					item.abstractNote = value;
				} else if(key == "rft.rights") {
					item.rights = value;
				} else if(key == "rft.language") {
				  	item.language = value;
				}  else if(key == "rft.subject") {
					item.tags.push(value);
				} else if(key == "rft.type") {
					if(Zotero.Utilities.itemTypeExists(value)) item.itemType = value;
				} else if(key == "rft.source") {
					item.publicationTitle = value;
				}
			}
		}
		
		// combine two lists of authors, eliminating duplicates
		for(var i=0; i<complexAu.length; i++) {
			var pushMe = true;
			for(var j=0; j<item.creators.length; j++) {
				// if there's a plain author that is close to this author (the
				// same last name, and the same first name up to a point), keep
				// the plain author, since it might have a middle initial
				if(item.creators[j].lastName == complexAu[i].lastName &&
				   (item.creators[j].firstName == complexAu[i].firstName == "" ||
				   (item.creators[j].firstName.length >= complexAu[i].firstName.length &&
				   item.creators[j].firstName.substr(0, complexAu[i].firstName.length) == complexAu[i].firstName))) {
					pushMe = false;
					break;
				}
			}
			if(pushMe) item.creators.push(au);
		}
		
		return item;
	}
	
	/*
	 * Used to map tags for generating OpenURL contextObjects
	 */
	function _mapTag(data, tag, version) {
		if(data) {
			if(version == "0.1") {
				return "&"+tag+"="+encodeURIComponent(data);
			} else {
				return "&rft."+tag+"="+encodeURIComponent(data);
			}
		} else {
			return "";
		}
	}
}