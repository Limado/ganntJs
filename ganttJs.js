var ganttCopy;
function GanttChart(div, calendar, Datos, name){

	this.textMarginLeft = 5;
	this.titleSpace = 200;
	this.rowHeight = 50;
	this.projectRowHeight = 40;
	this.toolTipLineHeight = 20;
	this.toolTipBackColor = "#d3d3d3";
	this.toolTipFontColor = "#999";
	this.workHours = 8;
	this.daySeparatorColor = "#d3d3d3";
	this.projectRowFontColor = "black";
	this.projectRowColor = "#999";
	this.projectRowFont = "12pt Calibri";
	this.dependencyLinePattern = "dotted";
	this.nonWorkingDayColor = "rgba(0, 0, 0, 0.5)";
	this.nonWorkingWeekendColor = "rgba(200, 80, 0, 0.5)";
	this.weekendColor = "rgba(0, 0, 0, 0.1)";
	
	this.projectName = name;
	this.projectFullName = name;
	if(this.projectName.length > 28) {
		this.projectName = this.projectName.substr(0,27) + "...";
	}
	
	this.containerId = div;
	this.container = document.getElementById(div);
	this.container.style.overflow = "auto";
	this.container.innerHTML = '<canvas id="ganttChartCanvas">Your browser does not support the HTML5 canvas tag.</canvas>';

	this.canvas = document.getElementById("ganttChartCanvas");
	
	this.tooltipDots = [];
	
	var border = 0;
	
	if(isNumber(parseInt(this.container.style.border.replace("px","")))) {
		border = parseInt(this.container.style.border.replace("px",""));
	}
	
	//this.canvas.width = this.container.offsetWidth - (border * 2) ;

	this.context = this.canvas.getContext("2d");
	
	this.errorMsg = "";
	
	this.nonWorkingDays = [];
	this.weekend = [];
	this.items = [];
	this.datos = Datos;

	//TOOLTIPS
	this.offsetX = 0; // Variable para DrawTooltip function Reoffset
	this.offsetY = 0; // Variable para DrawTooltip function Reoffset
	ganttCopy = this;
	this.container.addEventListener("mousemove", function(e){DrawTooltip(e,ganttCopy);}, false);
	/*
	// Necesario para el tooltip solo flotante
	_ganttChart.ReOffset();
	window.onscroll = function (e) { _ganttChart.ReOffset(); }
	window.onresize = function (e) { _ganttChart.ReOffset(); }
	*/
}

GanttChart.prototype.Init = function() {

	this.proyectDuration = 0;
	this.startDate = new Date('9999-12-31 00:00:00.000');
	this.endDate = new Date('1969-12-31 00:00:00.000');

	for (var i = 0; i < this.datos.length; i++){
		this.datos[i].push(this.workHours);		
		this.items[i] = new GanttItem(Datos[i]);
		this.proyectDuration += this.items[i].duration;

		this.items[i].startDate = this.ItemStartDate(this.items[i]);
		
		var NewData = this.ItemEndDateAndDuration(this.items[i]); 
		this.items[i].endDate = NewData[0];
		this.items[i].duration = NewData[1];
			
		this.SetDates(0,this.items[i].startDate);
		this.SetDates(1,this.items[i].endDate);

	}
	this.canvas.height = (this.items.length * this.rowHeight) + this.projectRowHeight;
	this.proyectRealDayDuration = dateDiffInDays(this.startDate,this.endDate)+1;

	this.proyectDayDuration = this.proyectDuration/this.workHours/60;
	
	//console.log("Dias reales: " + this.proyectRealDayDuration + " Neto: " + this.proyectDayDuration);
	console.log("Start: " + this.startDate + " End: " + this.endDate);
	this.proyectHourDuration = this.proyectDuration/60;
	
	//this.maxProyectWidth =  (this.workHours*60) * this.proyectDayDuration;
	this.canvas.width = this.titleSpace + ((this.workHours * 10) * this.proyectRealDayDuration);
	this.availableWidth = this.canvas.width - this.titleSpace;
	this.pixelXminuto = ((this.availableWidth/this.proyectRealDayDuration)/this.workHours)/60;
	//console.log("ProjectDay: " + this.proyectDayDuration + " PxMin: " + this.pixelXminuto);
	
}
GanttChart.prototype.SetWeekend = function(weekend){ 
	this.weekend = weekend;
}
GanttChart.prototype.SetNonWorkingDay = function(NonWorkingDays){ 
	for(var i = 0; i < NonWorkingDays.length; i++){
		var date = new Date(NonWorkingDays[i]);
		this.nonWorkingDays[i] = date.getTime();
	}
}
GanttChart.prototype.Clear = function(){
	this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

GanttChart.prototype.SetDates = function(t,date){ 
	if(t==0) {
		if((date.getTime() < this.startDate.getTime())) {
			this.startDate = date;
		}
	} else {
		if(date.getTime() > this.endDate.getTime()) {
			this.endDate = date;
		}	
	}
}
GanttChart.prototype.ValidateFormat = function(){
	this.ErrorMsg ="";
	return true;
}

GanttChart.prototype.ItemStartDate = function(Item){ 
	// Si tiene fecha de inicio la respeto pero valido que no empiece un dia no laboral
	var newStartDate;
	if(Item.realStartDate.getTime() != new Date(null).getTime()) 
	{
		newStartDate = Item.realStartDate;
	}
	
	if(Item.dependency != null && (Item.startDate.getTime() == new Date(null).getTime())) {
		var dependencies = this.FindDependencies(Item);
		var maxDate = dependencies[0].endDate;
		var newItem = dependencies[0];
		for(var i = 0; i < dependencies.length; i++) 
		{

				if(dependencies[i].endDate.getTime() > maxDate.getTime()) 
				{
					newItem = dependencies[i];
					maxDate = dependencies[i].endDate;
					//console.log("Dep. newItem " + newItem.taskName + " Item " + Item.taskName);
				}
		}
		var days = newItem.duration / (this.workHours * 60);
		newStartDate = newItem.startDate.addMinutes((days * 1440));
	} else {
		newStartDate = Item.startDate;
	}
	// CALCULO FECHA VALIDA DE TRABAJO TENIENDO EN CUENTA FERIADOS Y FINES DE SEMANA
		while(!this.ValidWorkingDate(newStartDate)) 
			{
				newStartDate = newStartDate.addMinutes(1440);
			}
		return newStartDate;
}

GanttChart.prototype.ItemEndDateAndDuration = function(Item){ 
			// Si tiene fecha de fin la respeto e igual valido que no termine en dia no laborable
	var newEndDate = Item.endDate;
	var newDuration = Item.duration;
	
	if(Item.realEndDate.getTime() != new Date(null).getTime()) 
		{
			newEndDate = Item.realEndDate.addMinutes(1440); //Agrego un dia, para que termine al final del mismo 24hs y no a las 00hs
			newDuration = Item.duration + this.workHours * 60; // Hago los mismo q a la fecha de fin, pero en minutos
		}

	if(newEndDate.getTime() == new Date(null).getTime()) {
		var days = Item.duration / (this.workHours * 60); // Dias netos de trabajo
		newEndDate = Item.startDate.addMinutes((days * 1440));
	}
	var dayMultiplier =  this.DayMultiplier(Item.startDate,newEndDate); //Dias reales de duración
	newEndDate = newEndDate.addMinutes(1440 * dayMultiplier);    
	newDuration = newDuration + ((this.workHours * 60) * dayMultiplier );
	return [newEndDate,newDuration];
}

//RECORRO TODAS LAS FECHAS DESDE startDate HASTA endDate DE CADA ITEM 
//PARA SABER SI PASA POR SABADOS, DOMINGOS Y FERIADOS Y RECALCULAR FECHA DE FIN Y DURACION
GanttChart.prototype.DayMultiplier = function(startDate, endDate){
	var daysToadd = 0;
	var days = dateDiffInDays(startDate,endDate.addMinutes(-1));
	//var days = dateDiffInDays(startDate,endDate);
	var date = startDate;
	for(var d = 0; d <= days; d++) 
	{
		//console.log(date);
		while(!this.ValidWorkingDate(date)) 
			{
				//console.log(date + " - " + daysToadd);
				date = date.addMinutes(1440);
				daysToadd++;
				
			}
		date = date.addMinutes(1440);
	}
	
	return daysToadd;
}

GanttChart.prototype.ValidWorkingDate = function(date){ 
	// SI ES SÁBADO, DOMINGO O FERIADO CALENDARIO NO CUENTA COMO DÍA VÁLIDO
	
	var month = parseInt(date.getMonth()) + parseInt(1);
	var stringDate = date.getFullYear() + "-" + month + "-" + date.getDate();
	date = new Date(stringDate + " 00:00:00");
	
	if(inArray(date.getTime(),this.nonWorkingDays) || inArray(date.getDay(),this.weekend)) {
		//console.log(date);
		return false;
	}
		return true;
}
GanttChart.prototype.GetItemByTaskId = function(taskId){

	for(var i = 0; i < this.items.length; i++){
		if(this.items[i].taskId == taskId) {
			return this.items[i];
		}
	}
	return false;
}

GanttChart.prototype.FindDependencies = function(Item){
	var dependencies = [];
	for(var i = 0; i < Item.dependency.length; i++) {
		dependencies[i] = this.GetItemByTaskId(Item.dependency[i]);
	}
	return dependencies;
}

GanttChart.prototype.ItemXPosition = function(itemStartDate) {
	var difMinutos = dateDiffInMinutes(this.startDate,itemStartDate);
	// Tomo las horas laborales del proyecto para calcular los minutos que tiene un dia para el gantt.
	var x = this.titleSpace + ( ((difMinutos * this.workHours * 60) / 1440) * this.pixelXminuto);
	return x; // Calculo los px correspondientes al porcentaje del item
}

GanttChart.prototype.Draw = function(e){
	this.Clear();
	this.OrderItemsByDate();
	this.DrawProjectRow();
	
	for(var i = 0; i < this.items.length; i++) {
		
		this.context.beginPath();
		if (IsEven(i)) {
			var basefillStyle = "#FAFAFA";	
		} else {
			var basefillStyle = "#F0F0F0";	
		}
		this.context.fillStyle = basefillStyle;
		this.context.fillRect(0, ((this.rowHeight*i)+this.projectRowHeight), this.canvas.width, this.rowHeight);
	
		this.items[i].x = this.ItemXPosition(this.items[i].startDate) + (this.items[i].cornerRadius/2);
		
		var y0 = (((this.rowHeight * i) + this.projectRowHeight)) + (this.items[i].cornerRadius/2);
		this.items[i].y = (y0 + (this.rowHeight - (this.rowHeight/3))/2) - (this.items[i].cornerRadius/2);

		this.items[i].width = (this.items[i].duration * this.pixelXminuto) - this.items[i].cornerRadius;
		this.items[i].height = this.rowHeight/3;
		this.items[i].rowIndex = i;
		this.items[i].toolTipDots = this.SetItemTooltipDots(this.items[i]);
		//this.tooltipDots[i] = this.SetItemTooltipDots(this.items[i]);
		
		
	 	this.items[i].Draw(this);
		this.DrawDependencyLine(this.items[i]);
	}
	
	this.DrawDayLine();
	this.container.style.cursor = "default";   
}

GanttChart.prototype.SetItemTooltipDots = function(Item){ 
	var x1, y1,x2,y2,tip;
	
	x1 = Item.x - Item.cornerRadius / 2;
	y1 = Item.y - Item.height - Item.cornerRadius / 2;
	x2 = Item.x + Item.width + Item.cornerRadius / 2;
	y2 = Item.y + Item.height + Item.cornerRadius / 2;;
	//tip = Item.fullTaskName;
	var dot = {x1: x1, y1: y1, x2: x2, y2: y2};
	return dot;
}

GanttChart.prototype.DrawProjectRow = function(){
		this.context.beginPath();
		this.context.fillStyle = this.projectRowColor;
		this.context.fillRect(0, 0, this.canvas.width, this.projectRowHeight);
		this.context.fillStyle = this.projectRowFontColor;
		this.context.font = this.projectRowFont;
		this.context.fillText(this.projectName, this.textMarginLeft, this.projectRowHeight/2);
}

GanttChart.prototype.DrawDayLine = function(){
	var pixelsPerDay = (this.availableWidth / this.proyectRealDayDuration);
	
	var startDate = this.startDate;

	for(var i = 0; i < this.proyectRealDayDuration; i++) {
	      this.context.beginPath();
		  this.context.moveTo(this.titleSpace + pixelsPerDay * i, 0);
		  this.context.lineTo(this.titleSpace + pixelsPerDay * i, this.canvas.height);
		  this.context.strokeStyle = this.daySeparatorColor;
		  this.context.lineWidth = "1";
		  this.context.filter = "none";
		  this.context.stroke();
		  this.context.font = this.projectRowFont;
		  this.context.fillStyle = this.projectRowFontColor;
		
		//FERIADOS POR CALENDARIO SETEADO
		if(startDate.getDay() == 6 || startDate.getDay() == 0) {
				this.context.fillStyle = this.weekendColor;
				this.context.fillRect(this.titleSpace + pixelsPerDay * i,this.projectRowHeight, pixelsPerDay ,  this.canvas.height);
				}
		//SABADOS Y DOMINGOS -- FALTA QUE SEAN PARAMETRIZABLES
		if(inArray(startDate.getDay(),this.weekend)) {
				this.context.fillStyle = this.nonWorkingWeekendColor;
				this.context.fillRect(this.titleSpace + pixelsPerDay * i,this.projectRowHeight, pixelsPerDay ,  this.canvas.height);
		  } 
		
		if(inArray(startDate.getTime(),this.nonWorkingDays)) {
				this.context.fillStyle = this.nonWorkingDayColor;
				this.context.fillRect(this.titleSpace + pixelsPerDay * i,this.projectRowHeight, pixelsPerDay ,  this.canvas.height);
				}
		  this.context.fillStyle = this.projectRowFontColor;
		  var date = startDate.getDate() + "/" + ("0" + (startDate.getMonth() + 1)).slice(-2);
		  this.context.fillText(getDayName(startDate.getDay()), this.titleSpace + pixelsPerDay * (i) + this.textMarginLeft, (this.projectRowHeight/2)-2);
		  this.context.fillText(date, this.titleSpace + pixelsPerDay * (i) + this.textMarginLeft , (this.projectRowHeight/2) + 12);
			
		  startDate = startDate.addMinutes(1440);  
	}
}

GanttChart.prototype.DrawDependencyLine = function(Item){
	if(Item.dependency != null) 
	{
		var dependencies = this.FindDependencies(Item);
		
		for(var i = 0; i < dependencies.length; i++){
			
			var father = dependencies[i];
			  this.context.beginPath();
			  this.context.lineWidth = "2";
			  this.context.strokeStyle = father.dependencyLineColor;
			  this.context.moveTo(father.x, father.y + father.height + Item.cornerRadius/2);

			if(this.dependencyLinePattern == "dotted" || this.dependencyLinePattern == "dashed") 
			{
			  this.context.drawDashedLine(father.x,
											father.y + father.height + father.cornerRadius/2,
											father.x, 
											Item.y - Item.height/2,
											this.dependencyLinePattern);
			  this.context.drawDashedLine(father.x, 
											Item.y - Item.height/2,
											father.x + Item.height,
											Item.y + Item.height/2,
											this.dependencyLinePattern);
			  this.context.drawDashedLine(father.x + Item.height,
											Item.y + Item.height/2,
											Item.x - Item.cornerRadius/2, 
											Item.y + Item.height/2,
											this.dependencyLinePattern);
			} else {
			  this.context.lineTo(father.x, Item.y - Item.height/2);
			  this.context.lineTo(father.x + Item.height, Item.y + Item.height/2);
			  this.context.lineTo(Item.x - Item.cornerRadius/2, Item.y + Item.height/2);
			  this.context.stroke();
			}
			  
		}
	}
	
}

GanttChart.prototype.OrderItemsByDate = function(){
	this.items.sort(function(a,b) { 
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime() 
});
	
}

GanttChart.prototype.ReOffset = function() {
	var canvasBC = this.canvas.getBoundingClientRect();
	var containerBC = this.container.getBoundingClientRect();
	
         this.offsetX = canvasBC.left;
         this.offsetY = canvasBC.top;

		 this.containerOffsetX = containerBC.left;
         this.containerOffsetY = containerBC.top;
	
    }

GanttChart.prototype.Download = function() {
	var link = document.createElement('a');
	link.href =  this.canvas.toDataURL("img/png");
	link.download = this.projectFullName + ".png";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

GanttChart.prototype.SetOptions = function (options){
	this.options = options;
	for (property in this){
		for(opt in options) {
			if(opt == property){
			this[property] = options[opt];
			}
		}
	}
	//this.Init(true);
}

function DrawTooltip(e,_ganttChart){
			  _ganttChart.Clear();
		  _ganttChart.Draw();
		  e.preventDefault();
		  e.stopPropagation();
		  _ganttChart.ReOffset();
		  var mouseX=parseInt(e.clientX-_ganttChart.offsetX);
		  var mouseY=parseInt(e.clientY-_ganttChart.offsetY);
		  var saltoLinea = " ** ";
	
		for(var i=0;i < _ganttChart.items.length;i++){

			var x1 = _ganttChart.items[i].toolTipDots.x1;
			var y1 = _ganttChart.items[i].toolTipDots.y1;
			var x2 = _ganttChart.items[i].toolTipDots.x2;
			var y2 = _ganttChart.items[i].toolTipDots.y2;
			
			x1 = _ganttChart.titleSpace;
			y1 = _ganttChart.projectRowHeight + (_ganttChart.rowHeight * i);

			x2 = _ganttChart.canvas.width;
			y2 = _ganttChart.projectRowHeight + (_ganttChart.rowHeight * (i+1));

			if( (mouseX >= x1 && mouseX <=x2) && (mouseY >= y1 && mouseY <=y2) )
			{
				_ganttChart.items[i].Draw(_ganttChart, true);
			
				_ganttChart.container.style.cursor="pointer";   
				_ganttChart.context.fillStyle = _ganttChart.toolTipBackColor;
				_ganttChart.context.fontColor = _ganttChart.toolTipFontColor;
				_ganttChart.context.fillRect((_ganttChart.offsetX*-1) + (_ganttChart.containerOffsetX),
											_ganttChart.projectRowHeight, 
											_ganttChart.titleSpace,  
											_ganttChart.canvas.height - _ganttChart.projectRowHeight);
				_ganttChart.context.fillStyle = _ganttChart.projectRowFontColor;
				//Salto de linea
				var inicio = _ganttChart.items[i].startDate.getDate() + "/" + ("0" + (_ganttChart.items[i].startDate.getMonth() + 1)).slice(-2);
				
				var dateEnd = _ganttChart.items[i].endDate.addMinutes(-1);
				var fin = dateEnd.getDate() + "/" + ("0" + (dateEnd.getMonth() + 1)).slice(-2);
				

				var texto = "Tarea: " + _ganttChart.items[i].fullTaskName + saltoLinea 
							+ "Inicio: " + inicio + saltoLinea 
							+ "Fin: " + fin + saltoLinea 
							+ "Duración: " + _ganttChart.items[i].horas + "hs.";
							
				_ganttChart.context.fillWrapText(texto, _ganttChart.textMarginLeft + (_ganttChart.offsetX*-1) + (_ganttChart.containerOffsetX), 
											_ganttChart.projectRowHeight + _ganttChart.toolTipLineHeight, 
											_ganttChart.titleSpace, _ganttChart.toolTipLineHeight)

				/*floatToolTip
				_ganttChart.context.fillStyle = _ganttChart.toolTipBackColor;
				_ganttChart.context.fontColor = _ganttChart.toolTipFontColor;
				_ganttChart.context.fillRect(mouseX + 25,mouseY, 150,  _ganttChart.projectRowHeight/2);
				_ganttChart.context.fillStyle = _ganttChart.projectRowFontColor;
				_ganttChart.context.fillText(_ganttChart.items[i].fullTaskName, mouseX + 30, mouseY + 12);
				*/

			} 

		}
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function GanttItem(data){

	this.SetData(data);
	
	this.color = "rgb(163, 198, 255)";
	this.fontColor = "blue";
	//this.strokeStyle = this.color;
	this.cornerRadius = 15;
	this.lineWidth = this.cornerRadius /2;
	this.font = "11pt Calibri";
	this.colorHover = "rgb(66, 134, 244)";
	//this.strokeStyleHover = this.colorHover;
	
	this.lineJoin = "round";
	this.dependencyLineColor = "rgb(57, 56, 63)";
	this.x = 0;
	this.y = 0;
	this.width = 0;
	this.height = 0;
	this.rowIndex = 0;
	this.toolTipDots = null;
	
}

GanttItem.prototype.SetData = function(data){
	this.taskId = data[0];
	this.taskName = data[1];
	this.fullTaskName = data[1];
	if(this.taskName.length > 28) {
		this.taskName = this.taskName.substr(0,27) + "...";
	}
	
	var dependencies = [];
	if(data[2] != null) {
		dependencies = data[2].split(',');	
		data[3] = null; // SI TENGO DEPENDENCIAS NO TOMO EN CUENTA LA FECHA DE INICIO.
	}
	this.dependency = dependencies;
	this.startDate = new Date(data[3]);
	this.endDate = new Date(data[4]);
	this.realStartDate = new Date(data[3]);
	this.realEndDate = new Date(data[4]);
	if(data[5] != null) {
		this.realDuration = data[5];
	} else {
		//array.pop() -> Retorna lastIndex y lo elimina. El lastIndex Siempre es el workHours del Gantt
		var days = dateDiffInDays(this.realStartDate, this.realEndDate);
		this.realDuration = days * data.pop() * 60;
		//console.log(this.realStartDate  + " - " + this.realEndDate + " -- " + days);
	}	
	this.duration = this.realDuration;
	this.complete = data[6];
	
	this.dias = this.duration/60/24;
	this.horas = this.duration/60;
	
}
GanttItem.prototype.SetOptions = function (options){
	//console.log(options.item);
	if(options.item != undefined) {
		for (property in this){
			for(opt in options.item) {
				if(opt == property){
					this[property] = options.item[opt];
				}
			}
		}
	}
}

GanttItem.prototype.Draw = function(gantt,hover){ 

		if(hover == true){
			gantt.context.fillStyle = this.colorHover;
			gantt.context.strokeStyle = this.colorHover;	
		} else {
			gantt.context.fillStyle = this.color;
			gantt.context.strokeStyle = this.color;
		}
	
		gantt.context.lineJoin = this.lineJoin;
		gantt.context.lineWidth = this.lineWidth;

		gantt.context.strokeRect(this.x, this.y, this.width, this.height);
		gantt.context.fillRect(this.x, this.y, this.width, this.height);
		
		//TITULO
		gantt.context.fillStyle = this.fontColor;
		gantt.context.font = this.font;
		gantt.context.fillStyle = gantt.fontColor;
        gantt.context.fillText(this.taskName, gantt.textMarginLeft, (gantt.rowHeight * this.rowIndex) + gantt.projectRowHeight + (gantt.rowHeight / 2) + 5);

}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function IsEven(num){
	if (num%2==0) {
		return true;
	} else {
		return false;
	}
}

function dateDiffInDays(date1, date2) {
	// Los meses de getMonth() van de 0 a 11.
    //debugger;
	var month = parseInt(date1.getMonth()) + parseInt(1);
	var stringDate = date1.getFullYear() + "-" + month + "-" + date1.getDate();
	date1 = new Date(stringDate + " 00:00:00");

	month = parseInt(date2.getMonth()) + parseInt(1);
	stringDate = date2.getFullYear() + "-" + month + "-" + date2.getDate();

	date2 = new Date(stringDate + " 00:00:00");

	var timeDiff = Math.abs(date2.getTime() - date1.getTime());
	var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
	//console.log(date1 + " -- " + date2 + " --- " + timeDiff + " ---- " + diffDays );
	
	return diffDays
}

function inArray(needle, haystack) {
//console.log(haystack);
    var length = haystack.length;
    for(var i = 0; i < length; i++) {
		//console.log("Date: " + needle + " toCompare: " + haystack[i]);
        if(haystack[i] == needle) return true;

    }
    return false;
}

function dateDiffInMinutes(dt2, dt1)   {  
  var diff =(dt2.getTime() - dt1.getTime()) / 1000;  
  diff /= 60;  
  return Math.abs(Math.round(diff));  

 }  

function getDayName(day) {

	switch(day){
		case 0:
		return "Domingo";
		case 1:
		return "Lunes";
		case 2:
		return "Martes";
		case 3:
		return "Miércoles";
		case 4:
		return "Jueves";
		case 5:
		return "Viernes";
		case 6:
		return "Sábado";
	}
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Date.prototype.addMinutes = function (minutes) {
    return new Date(this.getTime() + minutes * 60000);
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
CanvasRenderingContext2D.prototype.drawDashedLine = function(x1,y1,x2,y2,dashPadding){
                // Definir el espaciado de los guiones
                if(dashPadding == undefined || dashPadding == 'dashed')dashPadding = 4;
                else if(dashPadding == 'dotted') dashPadding = 1;
                else if(isNaN(dashPadding))throw "The dash padding must be a number or ('dotted' | 'dashed' ) strings";
                
                // Definir el ancho del guión
                var dashWidth = this.lineWidth * dashPadding;
                // Calcular el largo de la linea (hipotenusa)
                var adyacentLeg = x2 - x1;
                var opositeLeg = y2 - y1;
                var hypotenuse = Math.sqrt(adyacentLeg*adyacentLeg + opositeLeg*opositeLeg);
                
                // Calcular la cantidad de guiones que se dibujarán
                var dashCount = Math.floor(hypotenuse/dashWidth);
                // Calcular el incremento en ambos ejes
                var xIncrement = adyacentLeg/dashCount;
                var yIncrement = opositeLeg/dashCount;
                
                var dashIndex = 0;
                var xPosition = x1;
                var yPosition = y1;
                
                // Posicionar en el primer punto
                this.beginPath();
                this.moveTo(xPosition, yPosition);
                
                while(dashIndex++ < dashCount)
                {
                    // mover a la siguiente posición
                    xPosition += xIncrement;
                    yPosition += yIncrement;
                    
                    // Trazar el guión si es impar
                    if(dashIndex%2 == 0)this.moveTo(xPosition, yPosition);
                    else this.lineTo(xPosition, yPosition);
                }
                // Dibujar la linea
                this.stroke();
            }

CanvasRenderingContext2D.prototype.fillWrapText = function (text, x, y, maxWidth, lineHeight) {
        var words = text.split(' ');
        var line = '';

        for(var n = 0; n < words.length; n++) {
          var testLine = line + words[n] + ' ';
          var metrics = this.measureText(testLine);
          var testWidth = metrics.width;
          if(words[n] == "**")  //Salto de linea
		  {
			this.fillText(line, x, y);
            line = '';
            y += lineHeight;
			continue;
		  }
		  
		  if (testWidth > maxWidth && n > 0) {
            this.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        this.fillText(line, x, y);
      }
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


